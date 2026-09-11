import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Query,
  Request,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import { QuickBooksService } from './quickbooks.service';
import { ExchangeTokenDto } from './dto/exchange-token.dto';
import { CreateChargeDto } from './dto/create-charge.dto';

type CsvFormat = 'json' | 'csv';
function toCsv(rows: any[], columns: string[]): string {
  const header = columns.join(',');
  const lines = rows.map((r) =>
    columns.map((c) => JSON.stringify(r[c] ?? '')).join(','),
  );
  return [header, ...lines].join('\n');
}

function mapQboCustomerToContactRow(c: any): Record<string, string> {
  // QBO may have GivenName/FamilyName or only DisplayName — handle both
  let firstName = c.GivenName ?? '';
  let lastName = c.FamilyName ?? '';
  if (!firstName && !lastName && c.DisplayName) {
    const parts = String(c.DisplayName).trim().split(/\s+/);
    firstName = parts[0] ?? '';
    lastName = parts.slice(1).join(' ');
  }
  return {
    'First Name': firstName,
    'Last Name': lastName,
    Email: c.PrimaryEmailAddr?.Address ?? '',
    Phone: c.PrimaryPhone?.FreeFormNumber ?? '',
    'Date of Birth': '',
    Gender: '',
    District: '',
    Country: c.BillAddr?.Country ?? '',
    'Tithe Number': '',
    'QuickBooks Customer ID': c.Id ?? '',
  };
}

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('QuickBooks')
@Controller('api/integrations/quickbooks')
export class QuickBooksController {
  private readonly logger = new Logger(QuickBooksController.name);

  constructor(private readonly quickBooksService: QuickBooksService) {}

  /**
   * Step 1 — Get the Intuit authorization URL.
   *
   * Open the returned `url` in a browser. After the user consents and picks a
   * sandbox company, Intuit redirects to the configured redirect_uri with
   * `?code=&realmId=&state=`.
   *
   * - If redirect_uri is your server's /callback endpoint: the exchange happens
   *   automatically.
   * - If redirect_uri is https://developer.intuit.com/app/developer/quickstart:
   *   copy code/realmId/state from that page and POST them to /exchange.
   */
  @Get('connect')
  connect(@Request() req): { url: string; state: string } {
    return this.quickBooksService.getAuthorizationUrl(req.tenantId);
  }

  /**
   * OAuth callback — Intuit redirects here after the user consents.
   * Returns a minimal HTML page that posts a message to the opener popup
   * and closes itself. No JWT required; tenantId is recovered from state.
   */
  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('realmId') realmId: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const clientOrigin = process.env.APP_URL || 'http://localhost:3000';
    try {
      await this.quickBooksService.exchangeCodeForTokens({
        code,
        realmId,
        state,
      });
      res.setHeader('Content-Type', 'text/html');
      res.send(popupHtml('QB_CONNECT_SUCCESS', clientOrigin));
    } catch (err) {
      this.logger.error(`QuickBooks callback error: ${err.message}`);
      res.setHeader('Content-Type', 'text/html');
      res.send(popupHtml('QB_CONNECT_ERROR', clientOrigin));
    }
  }

  /**
   * Step 2b — Manual exchange (Intuit quickstart / dev flow).
   * After the quickstart page displays code/realmId/state, POST them here
   * with your JWT to complete the connection.
   */
  @Post('exchange')
  async exchange(@Body() dto: ExchangeTokenDto) {
    const connection = await this.quickBooksService.exchangeCodeForTokens(dto);
    return {
      message: 'QuickBooks connected',
      realmId: connection.realmId,
      environment: connection.environment,
      accessTokenExpiresAt: connection.accessTokenExpiresAt,
      refreshTokenExpiresAt: connection.refreshTokenExpiresAt,
    };
  }

  /** Current connection status for this tenant */
  @Get('connection')
  async getConnection(@Request() req) {
    const conn = await this.quickBooksService.getConnection(req.tenantId);
    if (!conn) return { connected: false };
    return {
      connected: true,
      realmId: conn.realmId,
      environment: conn.environment,
      accessTokenExpiresAt: conn.accessTokenExpiresAt,
      refreshTokenExpiresAt: conn.refreshTokenExpiresAt,
    };
  }

  /** Step 3a — QBO Accounting: company info */
  @Get('company-info')
  getCompanyInfo(@Request() req) {
    return this.quickBooksService.getCompanyInfo(req.tenantId);
  }

  /** Step 3b — OpenID: user info */
  @Get('userinfo')
  getUserInfo(@Request() req) {
    return this.quickBooksService.getUserInfo(req.tenantId);
  }

  /** Step 3c — Payments: create a test charge */
  @Post('charges')
  createCharge(@Request() req, @Body() dto: CreateChargeDto) {
    return this.quickBooksService.createCharge(req.tenantId, dto);
  }

  /** Remove the stored connection for this tenant */
  @Delete('connection')
  async disconnect(@Request() req) {
    await this.quickBooksService.revokeConnection(req.tenantId);
    return { message: 'QuickBooks disconnected' };
  }

  // ─── Reference data endpoints ─────────────────────────────────────────────

  @Get('references/customers')
  async getCustomers(
    @Request() req,
    @Query('format') format: CsvFormat = 'json',
    @Res() res: Response,
  ) {
    const rows = await this.quickBooksService.getQboCustomers(req.tenantId);
    if (format === 'csv') {
      const csvRows = rows.map(mapQboCustomerToContactRow);
      const columns = [
        'First Name',
        'Last Name',
        'Email',
        'Phone',
        'Date of Birth',
        'Gender',
        'District',
        'Country',
        'Tithe Number',
        'QuickBooks Customer ID',
      ];
      const header = columns.map((c) => JSON.stringify(c)).join(',');
      const lines = csvRows.map((r) =>
        columns.map((c) => JSON.stringify(r[c] ?? '')).join(','),
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="qbo-customers-contacts.csv"',
      );
      return res.send([header, ...lines].join('\n'));
    }
    return res.json(rows);
  }

  @Get('references/accounts')
  async getAccounts(
    @Request() req,
    @Query('format') format: CsvFormat = 'json',
    @Res() res: Response,
  ) {
    const rows = await this.quickBooksService.getQboAccounts(req.tenantId);
    return this.sendReference(res, rows, format, [
      'Id',
      'Name',
      'AccountType',
      'AccountSubType',
      'CurrencyRef',
    ]);
  }

  @Get('references/items')
  async getItems(
    @Request() req,
    @Query('format') format: CsvFormat = 'json',
    @Res() res: Response,
  ) {
    const rows = await this.quickBooksService.getQboItems(req.tenantId);
    return this.sendReference(res, rows, format, [
      'Id',
      'Name',
      'Description',
      'Type',
      'IncomeAccountRef',
    ]);
  }

  @Get('references/classes')
  async getClasses(
    @Request() req,
    @Query('format') format: CsvFormat = 'json',
    @Res() res: Response,
  ) {
    const rows = await this.quickBooksService.getQboClasses(req.tenantId);
    return this.sendReference(res, rows, format, [
      'Id',
      'Name',
      'FullyQualifiedName',
      'ParentRef',
    ]);
  }

  @Get('references/departments')
  async getDepartments(
    @Request() req,
    @Query('format') format: CsvFormat = 'json',
    @Res() res: Response,
  ) {
    const rows = await this.quickBooksService.getQboDepartments(req.tenantId);
    return this.sendReference(res, rows, format, [
      'Id',
      'Name',
      'FullyQualifiedName',
      'ParentRef',
    ]);
  }

  private sendReference(
    res: Response,
    rows: any[],
    format: CsvFormat,
    columns: string[],
  ) {
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="qbo-reference.csv"',
      );
      return res.send(toCsv(rows, columns));
    }
    return res.json(rows);
  }
}

function popupHtml(
  type: 'QB_CONNECT_SUCCESS' | 'QB_CONNECT_ERROR',
  origin: string,
): string {
  const ok = type === 'QB_CONNECT_SUCCESS';
  const color = ok ? '#2CA01C' : '#c62828';
  const heading = ok ? 'Connected!' : 'Connection failed.';
  const sub = ok
    ? "This window should close on its own — if it doesn't, feel free to close it using the button below."
    : 'Something went wrong. Please close this window and try again.';
  const payload = JSON.stringify({ type });

  // The parent window polls the connection status and closes this popup once it
  // detects the connection. postMessage is sent as a fast-path so the parent
  // can close the popup immediately without waiting for the next poll cycle.
  // window.close() is intentionally not called from script here — Chrome blocks
  // it after the popup has navigated through an external domain.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>QuickBooks</title>
  <style>
    body   { font-family: sans-serif; display: flex; flex-direction: column;
             align-items: center; justify-content: center; height: 100vh;
             margin: 0; background: #f5f5f5; gap: 12px; }
    h2     { margin: 0; color: ${color}; }
    p      { margin: 0; color: #555; font-size: 0.9rem; }
    button { margin-top: 8px; padding: 8px 20px; font-size: 0.9rem; cursor: pointer;
             border: 1px solid #bbb; border-radius: 6px; background: #fff; }
    button:hover { background: #f0f0f0; }
  </style>
</head>
<body>
  <h2>${heading}</h2>
  <p>${sub}</p>
  <button id="close-btn">Close this window</button>
  <script>
    try { window.opener.postMessage(${payload}, ${JSON.stringify(
      origin,
    )}); } catch (_) {}
    document.getElementById('close-btn').addEventListener('click', function () {
      window.close();
    });
  </script>
</body>
</html>`;
}
