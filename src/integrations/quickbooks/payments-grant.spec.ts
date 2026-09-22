import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
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
  });

  it('tells the operator to reconnect when Intuit refuses for permission', async () => {
    httpService.post.mockReturnValue(
      throwError(() => ({
        response: { status: 403, data: { code: 'ForbiddenAccess' } },
      })),
    );

    await expect(service.createCharge(1, charge)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.createCharge(1, charge)).rejects.toThrow(
      /disconnect QuickBooks and connect again/,
    );
  });

  it('leaves a card rejection alone, since reconnecting would not help', async () => {
    const declined = {
      response: { status: 400, data: { code: 'PAYMENT_DECLINED' } },
    };
    httpService.post.mockReturnValue(throwError(() => declined));

    await expect(service.createCharge(1, charge)).rejects.toBe(declined);
  });

  it('returns the charge when the grant is in place', async () => {
    httpService.post.mockReturnValue(of({ data: { id: 'ch_1' } }));

    await expect(service.createCharge(1, charge)).resolves.toEqual({
      id: 'ch_1',
    });
  });
});
