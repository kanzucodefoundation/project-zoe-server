import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import { ExternalSystemConnection } from './entities/external-system-connection.entity';
import { ExchangeTokenDto } from './dto/exchange-token.dto';
import { CreateChargeDto } from './dto/create-charge.dto';
import {
  QboAccount,
  QboCustomer,
  QboNamedEntity,
  QboSalesReceipt,
} from './quickbooks.types';

interface IntuitTokenResponse {
  token_type: string;
  expires_in: number;
  refresh_token: string;
  x_refresh_token_expires_in: number;
  access_token: string;
}

interface PendingState {
  tenantId: number;
  expiresAt: Date;
}

@Injectable()
export class QuickBooksService {
  private readonly logger = new Logger(QuickBooksService.name);

  // In-memory store for OAuth state → tenantId, TTL 10 min
  private readonly pendingStates = new Map<string, PendingState>();

  private readonly clientId = process.env.QUICKBOOKS_CLIENT_ID;
  private readonly clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  private readonly redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  private readonly environment =
    (process.env.QUICKBOOKS_ENVIRONMENT as 'sandbox' | 'production') ||
    'sandbox';

  private readonly scopes = [
    'com.intuit.quickbooks.accounting',
    'com.intuit.quickbooks.payment',
    'openid',
    'profile',
    'email',
    'phone',
    'address',
  ].join(' ');

  private readonly tokenUrl =
    'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

  constructor(
    @InjectRepository(ExternalSystemConnection)
    private readonly connectionRepo: Repository<ExternalSystemConnection>,
    private readonly httpService: HttpService,
  ) {}

  /** True when the OAuth credentials needed to talk to Intuit are present. */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  /**
   * Fails loudly when QuickBooks is not configured.
   *
   * Without this, a missing environment variable produced an authorization URL
   * containing `client_id=undefined`, and a Basic header built from
   * `undefined:undefined` — an outbound request that can only fail, with an
   * error that says nothing about the real cause.
   */
  private requireConfigured(): void {
    if (this.isConfigured()) return;
    throw new ServiceUnavailableException(
      'QuickBooks is not configured on this server. Set QUICKBOOKS_CLIENT_ID, ' +
        'QUICKBOOKS_CLIENT_SECRET and QUICKBOOKS_REDIRECT_URI to enable it.',
    );
  }

  getAuthorizationUrl(tenantId: number): { url: string; state: string } {
    this.requireConfigured();
    this.evictExpiredStates();
    const state = randomUUID();
    this.pendingStates.set(state, {
      tenantId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: this.scopes,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state,
    });

    return {
      url: `https://appcenter.intuit.com/connect/oauth2?${params}`,
      state,
    };
  }

  async exchangeCodeForTokens(
    dto: ExchangeTokenDto,
  ): Promise<ExternalSystemConnection> {
    const pending = this.pendingStates.get(dto.state);
    if (!pending || pending.expiresAt < new Date()) {
      this.pendingStates.delete(dto.state);
      throw new UnauthorizedException(
        'Invalid or expired OAuth state — start a new connection via /connect',
      );
    }
    const { tenantId } = pending;
    this.pendingStates.delete(dto.state);

    const tokenData = await this.postTokenRequest({
      grant_type: 'authorization_code',
      code: dto.code,
      redirect_uri: this.redirectUri,
    });

    return this.upsertConnection(tenantId, dto.realmId, tokenData);
  }

  async getCompanyInfo(tenantId: number): Promise<unknown> {
    return this.withAuth(tenantId, async (accessToken, realmId) => {
      const base = this.accountingApiBase();
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${base}/v3/company/${realmId}/companyinfo/${realmId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
            params: { minorversion: 65 },
          },
        ),
      );
      return data;
    });
  }

  async getUserInfo(tenantId: number): Promise<unknown> {
    return this.withAuth(tenantId, async (accessToken) => {
      const base =
        this.environment === 'sandbox'
          ? 'https://sandbox-accounts.platform.intuit.com'
          : 'https://accounts.platform.intuit.com';

      const { data } = await firstValueFrom(
        this.httpService.get(`${base}/v1/openid_connect/userinfo`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
      return data;
    });
  }

  async createCharge(tenantId: number, dto: CreateChargeDto): Promise<any> {
    const { accessToken, realmId } = await this.getValidAccessToken(tenantId);
    const base =
      this.environment === 'sandbox'
        ? 'https://sandbox.api.intuit.com'
        : 'https://api.intuit.com';

    const { data } = await firstValueFrom(
      this.httpService.post(
        `${base}/quickbooks/v4/payments/charges`,
        {
          amount: dto.amount.toFixed(2),
          currency: dto.currency,
          card: {
            number: dto.cardNumber,
            expMonth: dto.expMonth,
            expYear: dto.expYear,
            cvc: dto.cvc,
            name: dto.cardholderName,
          },
          description: dto.description,
          context: {
            mobile: false,
            isEcommerce: true,
            reconnect: false,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Request-Id': randomUUID(),
          },
        },
      ),
    );
    this.logger.log(
      `Charge created for tenant ${tenantId}, realmId ${realmId}`,
    );
    return data;
  }

  async getConnection(
    tenantId: number,
  ): Promise<ExternalSystemConnection | null> {
    return this.connectionRepo.findOne({
      where: { tenantId, system: 'quickbooks' },
    });
  }

  async revokeConnection(tenantId: number): Promise<void> {
    await this.connectionRepo.delete({ tenantId, system: 'quickbooks' });
  }

  // ─── QBO reference data ────────────────────────────────────────────────────

  async getQboCustomers(tenantId: number): Promise<QboCustomer[]> {
    return this.qboQueryAll<QboCustomer>(tenantId, 'Customer');
  }

  async getQboAccounts(tenantId: number): Promise<QboAccount[]> {
    return this.qboQueryAll<QboAccount>(tenantId, 'Account');
  }

  async getQboItems(tenantId: number): Promise<QboNamedEntity[]> {
    return this.qboQueryAll<QboNamedEntity>(tenantId, 'Item');
  }

  async getQboClasses(tenantId: number): Promise<QboNamedEntity[]> {
    return this.qboQueryAll<QboNamedEntity>(tenantId, 'Class');
  }

  async getQboDepartments(tenantId: number): Promise<QboNamedEntity[]> {
    return this.qboQueryAll<QboNamedEntity>(tenantId, 'Department');
  }

  /**
   * Every active record of one entity type, following QuickBooks' paging.
   *
   * A single query returns at most 1000 rows. A church with more customers than
   * that would silently get a truncated list, and the records beyond the first
   * page could never be matched or mapped.
   */
  private async qboQueryAll<T>(
    tenantId: number,
    entity: 'Customer' | 'Account' | 'Item' | 'Class' | 'Department',
  ): Promise<T[]> {
    const pageSize = 1000;
    const all: T[] = [];

    for (let start = 1; ; start += pageSize) {
      const page = await this.qboQuery<T>(
        tenantId,
        `SELECT * FROM ${entity} WHERE Active = true STARTPOSITION ${start} MAXRESULTS ${pageSize}`,
      );
      all.push(...page);
      if (page.length < pageSize) break;
    }

    return all;
  }

  /**
   * Escapes a value for interpolation into a QBO query string literal.
   * Intuit's query language escapes single quotes with a backslash.
   */
  private escapeQboLiteral(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  async findQboCustomerByDisplayName(
    tenantId: number,
    displayName: string,
  ): Promise<QboCustomer | null> {
    const rows = await this.qboQuery<QboCustomer>(
      tenantId,
      `SELECT * FROM Customer WHERE DisplayName = '${this.escapeQboLiteral(
        displayName,
      )}'`,
    );
    return rows[0] ?? null;
  }

  async createQboCustomer(
    tenantId: number,
    payload: Record<string, unknown>,
  ): Promise<QboCustomer> {
    const customer = await this.withAuth(
      tenantId,
      async (accessToken, realmId) => {
        const base = this.accountingApiBase();
        const { data } = await firstValueFrom(
          this.httpService.post(
            `${base}/v3/company/${realmId}/customer`,
            payload,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              params: { minorversion: 65 },
            },
          ),
        );
        return data?.Customer ?? data;
      },
    );
    this.logger.log(
      `Created QuickBooks customer "${payload.DisplayName}" for tenant ${tenantId}`,
    );
    return customer;
  }

  /**
   * Sparse-updates a customer. QuickBooks requires the current `SyncToken` on
   * every write, so callers must read the customer first; passing a stale token
   * is rejected rather than silently overwriting someone else's change.
   */
  async updateQboCustomer(
    tenantId: number,
    payload: Record<string, unknown>,
  ): Promise<QboCustomer> {
    return this.withAuth(tenantId, async (accessToken, realmId) => {
      const base = this.accountingApiBase();
      const { data } = await firstValueFrom(
        this.httpService.post(
          `${base}/v3/company/${realmId}/customer`,
          { ...payload, sparse: true },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            params: { minorversion: 65 },
          },
        ),
      );
      return data?.Customer ?? data;
    });
  }

  /** One customer by id, including its `SyncToken` and `ParentRef`. */
  async getQboCustomer(
    tenantId: number,
    id: string,
  ): Promise<QboCustomer | null> {
    const rows = await this.qboQuery<QboCustomer>(
      tenantId,
      `SELECT * FROM Customer WHERE Id = '${this.escapeQboLiteral(id)}'`,
    );
    return rows[0] ?? null;
  }

  private async qboQuery<T>(tenantId: number, query: string): Promise<T[]> {
    return this.withAuth(tenantId, async (accessToken, realmId) => {
      const base = this.accountingApiBase();
      const { data } = await firstValueFrom(
        this.httpService.get(`${base}/v3/company/${realmId}/query`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
          params: { query, minorversion: 65 },
        }),
      );
      const queryResponse = data?.QueryResponse ?? {};
      // QBO wraps results under the entity name, e.g. { Customer: [...] }
      const entities = Object.values(queryResponse).find(Array.isArray);
      return (entities as T[]) ?? [];
    });
  }

  accountingApiBase(): string {
    return this.environment === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';
  }

  /**
   * Creates a sales receipt in QuickBooks.
   *
   * `requestId` is Intuit's idempotency key. It matters because this call can
   * be retried in two ways that neither the caller nor this method can tell
   * apart from a first attempt: `withAuth` refreshes and retries on a 401 —
   * Intuit may already have accepted the first request before rejecting the
   * token on it — and a request that times out may have been accepted with the
   * response lost on the way back. Without a key, each retry creates another
   * receipt and a giver is credited twice.
   *
   * Given the same key and the same operation, Intuit returns the original
   * response instead of creating a second document, which makes a retry safe.
   * The caller derives the key from the transaction, so it is stable across
   * every attempt at posting that one gift. Intuit caps it at 50 characters.
   */
  async postSalesReceipt(
    tenantId: number,
    payload: Record<string, unknown>,
    requestId?: string,
  ): Promise<QboSalesReceipt> {
    return this.withAuth(tenantId, async (accessToken, realmId) => {
      const base = this.accountingApiBase();
      const params: Record<string, unknown> = { minorversion: 65 };
      if (requestId) {
        params.requestid = requestId.slice(0, 50);
      }
      const { data } = await firstValueFrom(
        this.httpService.post(
          `${base}/v3/company/${realmId}/salesreceipt`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            params,
          },
        ),
      );
      return data?.SalesReceipt ?? data;
    });
  }

  /**
   * Runs an authenticated QuickBooks call, refreshing the token and retrying
   * once if Intuit rejects it.
   *
   * `getValidAccessToken` only refreshes ahead of a known expiry. A token can
   * still be rejected inside that window — Intuit expires it early, or the
   * stored copy is stale — and without a retry every later call in the same
   * batch fails the same way, so one unlucky receipt took the rest of the run
   * down with it.
   */
  private async withAuth<T>(
    tenantId: number,
    run: (accessToken: string, realmId: string) => Promise<T>,
  ): Promise<T> {
    const { accessToken, realmId } = await this.getValidAccessToken(tenantId);

    try {
      return await run(accessToken, realmId);
    } catch (err) {
      if (err?.response?.status !== 401) {
        throw err;
      }

      const connection = await this.connectionRepo.findOne({
        where: { tenantId, system: 'quickbooks' },
      });
      if (!connection) {
        throw err;
      }

      this.logger.warn(
        `QuickBooks rejected the access token for tenant ${tenantId}; refreshing and retrying once`,
      );
      const refreshed = await this.refreshAccessToken(connection);
      return run(refreshed.accessToken, refreshed.realmId);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async getValidAccessToken(
    tenantId: number,
  ): Promise<{ accessToken: string; realmId: string }> {
    const connection = await this.connectionRepo.findOne({
      where: { tenantId, system: 'quickbooks' },
    });
    if (!connection) {
      throw new NotFoundException(
        'No QuickBooks connection found. Authorize via GET /api/integrations/quickbooks/connect first.',
      );
    }

    // Refresh proactively 5 minutes before expiry
    const bufferMs = 5 * 60 * 1000;
    if (connection.accessTokenExpiresAt.getTime() - Date.now() < bufferMs) {
      const refreshed = await this.refreshAccessToken(connection);
      return { accessToken: refreshed.accessToken, realmId: refreshed.realmId };
    }

    return { accessToken: connection.accessToken, realmId: connection.realmId };
  }

  private async refreshAccessToken(
    connection: ExternalSystemConnection,
  ): Promise<ExternalSystemConnection> {
    this.logger.log(
      `Refreshing QuickBooks access token for tenant ${connection.tenantId}`,
    );
    const tokenData = await this.postTokenRequest({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
    });
    return this.upsertConnection(
      connection.tenantId,
      connection.realmId,
      tokenData,
    );
  }

  private async postTokenRequest(
    body: Record<string, string>,
  ): Promise<IntuitTokenResponse> {
    this.requireConfigured();
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const { data } = await firstValueFrom(
      this.httpService.post<IntuitTokenResponse>(
        this.tokenUrl,
        new URLSearchParams(body).toString(),
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
        },
      ),
    );
    return data;
  }

  private async upsertConnection(
    tenantId: number,
    realmId: string,
    tokenData: IntuitTokenResponse,
  ): Promise<ExternalSystemConnection> {
    const now = Date.now();
    const existing = await this.connectionRepo.findOne({
      where: { tenantId, system: 'quickbooks' },
    });

    const conn =
      existing ??
      this.connectionRepo.create({ tenantId, system: 'quickbooks' });

    conn.realmId = realmId;
    conn.environment = this.environment;
    conn.accessToken = tokenData.access_token;
    conn.refreshToken = tokenData.refresh_token;
    conn.accessTokenExpiresAt = new Date(now + tokenData.expires_in * 1000);
    conn.refreshTokenExpiresAt = new Date(
      now + tokenData.x_refresh_token_expires_in * 1000,
    );

    return this.connectionRepo.save(conn);
  }

  private evictExpiredStates(): void {
    const now = new Date();
    for (const [key, val] of this.pendingStates) {
      if (val.expiresAt < now) this.pendingStates.delete(key);
    }
  }
}
