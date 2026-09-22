import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { QuickBooksService } from './quickbooks.service';
import { ExternalSystemConnection } from './entities/external-system-connection.entity';

describe('QuickBooksService — charging without a payments grant', () => {
  let service: QuickBooksService;
  let httpService: { post: jest.Mock };

  const charge = {
    amount: 1000,
    currency: 'UGX',
    cardNumber: '4111111111111111',
    expMonth: '12',
    expYear: '2030',
    cvc: '123',
    cardholderName: 'Joshua Nabugere',
    description: 'Tithe',
    requestId: 'charge-1',
  } as any;

  beforeEach(async () => {
    httpService = { post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuickBooksService,
        { provide: HttpService, useValue: httpService },
        {
          provide: getRepositoryToken(ExternalSystemConnection),
          useValue: { findOne: jest.fn(), save: jest.fn(), delete: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(QuickBooksService);
    jest
      .spyOn(service as any, 'getValidAccessToken')
      .mockResolvedValue({ accessToken: 'tok', realmId: '123' });
    (service as any).connectionRepo.findOne.mockResolvedValue({
      id: 1,
      tenantId: 1,
    });
    jest
      .spyOn(service as any, 'refreshAccessToken')
      .mockResolvedValue({ accessToken: 'fresh', realmId: '123' });
  });

  it('tells the operator to reconnect when Intuit refuses for permission', async () => {
    httpService.post.mockReturnValue(
      throwError(() => ({
        response: { status: 403, data: { code: 'ForbiddenAccess' } },
      })),
    );

    await expect(service.createCharge(1, charge, 'charge-1')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.createCharge(1, charge, 'charge-1')).rejects.toThrow(
      /disconnect QuickBooks and connect again/,
    );
  });

  it('leaves a card rejection alone, since reconnecting would not help', async () => {
    const declined = {
      response: { status: 400, data: { code: 'PAYMENT_DECLINED' } },
    };
    httpService.post.mockReturnValue(throwError(() => declined));

    await expect(service.createCharge(1, charge, 'charge-1')).rejects.toBe(
      declined,
    );
  });

  it('returns the charge when the grant is in place', async () => {
    httpService.post.mockReturnValue(of({ data: { id: 'ch_1' } }));

    await expect(service.createCharge(1, charge, 'charge-1')).resolves.toEqual({
      id: 'ch_1',
    });
  });

  it('refreshes a stale token and retries before blaming the grant', async () => {
    // First attempt 401s on a stale-but-unexpired token; the retry succeeds.
    httpService.post
      .mockReturnValueOnce(
        throwError(() => ({ response: { status: 401, data: {} } })),
      )
      .mockReturnValueOnce(of({ data: { id: 'ch_2' } }));

    await expect(service.createCharge(1, charge, 'charge-1')).resolves.toEqual({
      id: 'ch_2',
    });
    expect((service as any).refreshAccessToken).toHaveBeenCalled();
  });

  it('reuses the same key on every attempt, so a retry cannot double-charge', async () => {
    httpService.post
      .mockReturnValueOnce(
        throwError(() => ({ response: { status: 401, data: {} } })),
      )
      .mockReturnValueOnce(of({ data: { id: 'ch_3' } }));

    await service.createCharge(1, charge, 'charge-1');

    const keys = httpService.post.mock.calls.map(
      (call: any[]) => call[2].headers['Request-Id'],
    );
    expect(keys).toEqual(['charge-1', 'charge-1']);
  });

  describe('when the refresh itself fails', () => {
    beforeEach(() => {
      // Let the real refresh run so the token endpoint's answer is what decides.
      (service as any).refreshAccessToken.mockRestore();
      (service as any).clientId = 'id';
      (service as any).clientSecret = 'secret';
      (service as any).redirectUri = 'http://localhost/cb';
    });

    it('asks for a reconnect when the refresh token is dead', async () => {
      httpService.post
        // The charge 401s, then the token endpoint rejects the refresh.
        .mockReturnValueOnce(
          throwError(() => ({ response: { status: 401, data: {} } })),
        )
        .mockReturnValueOnce(
          throwError(() => ({
            response: { status: 400, data: { error: 'invalid_grant' } },
          })),
        );

      // One call only: the queued `once` responses are consumed by it.
      const error = await service
        .createCharge(1, charge, 'charge-1')
        .catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toMatch(/expired or been revoked/);
    });

    it('leaves any other refresh failure as it was', async () => {
      const upstream = {
        response: { status: 500, data: { error: 'server_error' } },
      };
      httpService.post
        .mockReturnValueOnce(
          throwError(() => ({ response: { status: 401, data: {} } })),
        )
        .mockReturnValueOnce(throwError(() => upstream));

      await expect(service.createCharge(1, charge, 'charge-1')).rejects.toBe(
        upstream,
      );
    });

    it('still passes a card decline straight through', async () => {
      const declined = {
        response: { status: 400, data: { code: 'PAYMENT_DECLINED' } },
      };
      httpService.post.mockReturnValue(throwError(() => declined));

      await expect(service.createCharge(1, charge, 'charge-1')).rejects.toBe(
        declined,
      );
    });
  });
});
