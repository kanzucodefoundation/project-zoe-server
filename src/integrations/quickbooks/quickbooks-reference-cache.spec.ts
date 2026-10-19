import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { QuickBooksService } from './quickbooks.service';
import { ExternalSystemConnection } from './entities/external-system-connection.entity';

/**
 * The posting dialog reads the company's customers, items and accounts every
 * time it opens. Each read is a multi-page QuickBooks round trip, and reading
 * it per open is what pushed the dialog past the browser's request timeout.
 */
describe('QuickBooksService — reference data', () => {
  let service: QuickBooksService;
  let httpService: { get: jest.Mock; post: jest.Mock };
  let connectionRepo: {
    findOne: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const page = (size: number) =>
    Array.from({ length: size }, (_, i) => ({ Id: String(i + 1) }));

  const tokenResponse = {
    token_type: 'bearer',
    access_token: 'access',
    refresh_token: 'refresh',
    expires_in: 3600,
    x_refresh_token_expires_in: 8_726_400,
  };

  beforeEach(async () => {
    httpService = { get: jest.fn(), post: jest.fn() };
    connectionRepo = {
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuickBooksService,
        {
          provide: getRepositoryToken(ExternalSystemConnection),
          useValue: connectionRepo,
        },
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    service = module.get(QuickBooksService);
    (service as any).withAuth = (
      _tenantId: number,
      run: (token: string, realm: string) => unknown,
    ) => run('token', 'realm');
  });

  const stubQuery = (pages: unknown[][]) => {
    const query = jest.fn();
    pages.forEach((rows) => query.mockResolvedValueOnce(rows));
    query.mockResolvedValue([]);
    (service as any).qboQuery = query;
    return query;
  };

  it('reads QuickBooks once for repeated requests', async () => {
    const query = stubQuery([[{ Id: '1' }]]);

    await service.getQboCustomers(1);
    await service.getQboCustomers(1);
    const third = await service.getQboCustomers(1);

    expect(query).toHaveBeenCalledTimes(1);
    expect(third).toHaveLength(1);
  });

  it('shares one read between dialogs opening at the same time', async () => {
    const query = stubQuery([[{ Id: '1' }]]);

    await Promise.all([service.getQboCustomers(1), service.getQboCustomers(1)]);

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('keeps tenants apart', async () => {
    const query = stubQuery([[{ Id: '1' }], [{ Id: '2' }]]);

    await service.getQboCustomers(1);
    await service.getQboCustomers(2);

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed read', async () => {
    const query = jest
      .fn()
      .mockRejectedValueOnce(new Error('QuickBooks down'))
      .mockResolvedValue([{ Id: '1' }]);
    (service as any).qboQuery = query;

    await expect(service.getQboItems(1)).rejects.toThrow('QuickBooks down');
    await expect(service.getQboItems(1)).resolves.toHaveLength(1);
  });

  it('a failing read does not evict the entry that replaced it', async () => {
    // The first read is still in flight when a customer write clears the
    // cache and a second read caches its own result. The first then fails;
    // it must not take the second read's entry with it.
    let failFirst: (err: Error) => void = () => undefined;
    const query = jest
      .fn()
      .mockImplementationOnce(
        () => new Promise((_resolve, reject) => (failFirst = reject)),
      )
      .mockResolvedValue([{ Id: '9' }]);
    (service as any).qboQuery = query;

    const inFlight = service.getQboItems(1).catch(() => 'failed');
    (service as any).invalidateReferenceCache(1);
    await service.getQboItems(1);

    failFirst(new Error('QuickBooks down'));
    await inFlight;

    // Served from the entry the second read stored, so no third query.
    await expect(service.getQboItems(1)).resolves.toHaveLength(1);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('follows every page of a company larger than one page', async () => {
    const query = stubQuery([page(1000), page(1000), page(7)]);

    const rows = await service.getQboCustomers(1);

    expect(rows).toHaveLength(2007);
  });

  it('drops the cached customers after creating one', async () => {
    const query = stubQuery([[{ Id: '1' }], [{ Id: '1' }, { Id: '2' }]]);
    httpService.post.mockReturnValue(
      of({ data: { Customer: { Id: '2', DisplayName: 'New Giver' } } }),
    );

    await service.getQboCustomers(1);
    await service.createQboCustomer(1, { DisplayName: 'New Giver' });
    const rows = await service.getQboCustomers(1);

    expect(query).toHaveBeenCalledTimes(2);
    expect(rows).toHaveLength(2);
  });

  it('leaves other reference lists cached when a customer is created', async () => {
    const query = stubQuery([[{ Id: '1' }]]);
    httpService.post.mockReturnValue(of({ data: { Customer: { Id: '2' } } }));

    await service.getQboItems(1);
    await service.createQboCustomer(1, { DisplayName: 'New Giver' });
    await service.getQboItems(1);

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('drops the cached customers after editing one', async () => {
    const query = stubQuery([[{ Id: '1', DisplayName: 'Old' }]]);
    httpService.post.mockReturnValue(
      of({ data: { Customer: { Id: '1', DisplayName: 'New' } } }),
    );

    await service.getQboCustomers(1);
    await service.updateQboCustomer(1, { Id: '1', SyncToken: '0' });
    await service.getQboCustomers(1);

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('drops cached rows when the connection is revoked', async () => {
    const query = stubQuery([[{ Id: '1' }]]);

    await service.getQboCustomers(1);
    await service.revokeConnection(1);
    await service.getQboCustomers(1);

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('drops cached rows when the tenant reconnects to another company', async () => {
    const query = stubQuery([[{ Id: '1' }]]);
    connectionRepo.findOne.mockResolvedValue({
      tenantId: 1,
      system: 'quickbooks',
      realmId: 'realm-a',
    });

    await service.getQboCustomers(1);
    await (service as any).upsertConnection(1, 'realm-b', tokenResponse);
    await service.getQboCustomers(1);

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('keeps cached rows through a token refresh on the same company', async () => {
    const query = stubQuery([[{ Id: '1' }]]);
    connectionRepo.findOne.mockResolvedValue({
      tenantId: 1,
      system: 'quickbooks',
      realmId: 'realm-a',
    });

    await service.getQboCustomers(1);
    await (service as any).upsertConnection(1, 'realm-a', tokenResponse);
    await service.getQboCustomers(1);

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('retries a throttled page rather than failing the read', async () => {
    const throttled = Object.assign(new Error('Too Many Requests'), {
      response: { status: 429, headers: { 'retry-after': '0.01' } },
    });
    const query = jest
      .fn()
      .mockRejectedValueOnce(throttled)
      .mockResolvedValue([{ Id: '1' }]);
    (service as any).qboQuery = query;

    await expect(service.getQboCustomers(1)).resolves.toHaveLength(1);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('gives up on a page Intuit keeps throttling', async () => {
    const throttled = Object.assign(new Error('Too Many Requests'), {
      response: { status: 429, headers: { 'retry-after': '0.01' } },
    });
    (service as any).qboQuery = jest.fn().mockRejectedValue(throttled);

    await expect(service.getQboCustomers(1)).rejects.toMatchObject({
      response: { status: 429 },
    });
  });

  /**
   * Five getters paging at once would otherwise put twenty requests on one
   * company at the same time, which Intuit answers with 429s.
   */
  it('keeps concurrent reference reads inside the request budget', async () => {
    const pagesServed = new Map<string, number>();
    let inFlight = 0;
    let peak = 0;

    (service as any).qboQuery = jest.fn(
      async (_tenantId: number, query: string) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setImmediate(resolve));
        inFlight -= 1;

        const entity = /FROM (\w+)/.exec(query)?.[1] ?? '';
        const served = (pagesServed.get(entity) ?? 0) + 1;
        pagesServed.set(entity, served);
        return served === 1 ? page(1000) : [];
      },
    );

    await Promise.all([
      service.getQboCustomers(1),
      service.getQboItems(1),
      service.getQboAccounts(1),
      service.getQboClasses(1),
      service.getQboDepartments(1),
    ]);

    expect(peak).toBeLessThanOrEqual(6);
    expect(peak).toBeGreaterThan(1);
  });

  // Mirrors QBO_REFERENCE_CACHE_TTL_MS in the service.
  const ttlMs = 10 * 60 * 1000;

  it('drops an aged-out entry for a tenant that never reads again', async () => {
    stubQuery([[{ Id: '1' }]]);
    const cache: Map<string, unknown> = (service as any).referenceCache;
    const start = Date.now();
    const clock = jest.spyOn(Date, 'now');

    try {
      clock.mockReturnValue(start);
      await service.getQboCustomers(1);
      expect([...cache.keys()]).toEqual(['1:Customer']);

      // Tenant 1 never comes back. Another tenant's miss is what collects it,
      // so its resolved row list does not sit in memory for the process life.
      clock.mockReturnValue(start + ttlMs + 1);
      await service.getQboCustomers(2);

      expect([...cache.keys()]).toEqual(['2:Customer']);
    } finally {
      clock.mockRestore();
    }
  });

  it('keeps a live entry for another tenant when one tenant misses', async () => {
    stubQuery([[{ Id: '1' }]]);
    const cache: Map<string, unknown> = (service as any).referenceCache;
    const start = Date.now();
    const clock = jest.spyOn(Date, 'now');

    try {
      clock.mockReturnValue(start);
      await service.getQboCustomers(1);

      // Still inside the TTL, so collecting must not touch it.
      clock.mockReturnValue(start + ttlMs - 1);
      await service.getQboCustomers(2);

      expect([...cache.keys()].sort()).toEqual(['1:Customer', '2:Customer']);
    } finally {
      clock.mockRestore();
    }
  });
});
