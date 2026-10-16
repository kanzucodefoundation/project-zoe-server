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

  const page = (size: number) =>
    Array.from({ length: size }, (_, i) => ({ Id: String(i + 1) }));

  beforeEach(async () => {
    httpService = { get: jest.fn(), post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuickBooksService,
        {
          provide: getRepositoryToken(ExternalSystemConnection),
          useValue: { findOne: jest.fn(), delete: jest.fn() },
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
});
