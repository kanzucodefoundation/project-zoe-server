import {
  Injectable,
  Logger,
  NotFoundException,
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

  getAuthorizationUrl(tenantId: number): { url: string; state: string } {
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

  async getCompanyInfo(tenantId: number): Promise<any> {
    const { accessToken, realmId } = await this.getValidAccessToken(tenantId);
    const base =
      this.environment === 'sandbox'
        ? 'https://sandbox-quickbooks.api.intuit.com'
        : 'https://quickbooks.api.intuit.com';

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
  }

  async getUserInfo(tenantId: number): Promise<any> {
    const { accessToken } = await this.getValidAccessToken(tenantId);
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

  async getQboCustomers(tenantId: number): Promise<any[]> {
    return this.qboQuery(
      tenantId,
      'SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000',
    );
  }

  async getQboAccounts(tenantId: number): Promise<any[]> {
    return this.qboQuery(
      tenantId,
      'SELECT * FROM Account WHERE Active = true MAXRESULTS 1000',
    );
  }

  async getQboItems(tenantId: number): Promise<any[]> {
    return this.qboQuery(
      tenantId,
      'SELECT * FROM Item WHERE Active = true MAXRESULTS 1000',
    );
  }

  async getQboClasses(tenantId: number): Promise<any[]> {
    return this.qboQuery(
      tenantId,
      'SELECT * FROM Class WHERE Active = true MAXRESULTS 1000',
    );
  }

  async getQboDepartments(tenantId: number): Promise<any[]> {
    return this.qboQuery(
      tenantId,
      'SELECT * FROM Department WHERE Active = true MAXRESULTS 1000',
    );
  }

  private async qboQuery(tenantId: number, query: string): Promise<any[]> {
    const { accessToken, realmId } = await this.getValidAccessToken(tenantId);
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
    return (entities as any[]) ?? [];
  }

  accountingApiBase(): string {
    return this.environment === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';
  }

  async postSalesReceipt(
    tenantId: number,
    payload: Record<string, any>,
  ): Promise<any> {
    const { accessToken, realmId } = await this.getValidAccessToken(tenantId);
    const base = this.accountingApiBase();
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
          params: { minorversion: 65 },
        },
      ),
    );
    return data?.SalesReceipt ?? data;
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
