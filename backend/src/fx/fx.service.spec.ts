import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { FxService } from './fx.service';
import { FxRateProvider } from './fx.provider';
import { FxRepository } from './fx.repository';

const row = (quote: string, rate: string, ageMs = 0) => ({
  base: 'USD',
  quote,
  rate,
  rateDate: '2026-10-29',
  fetchedAt: new Date(Date.now() - ageMs),
});

describe('FxService', () => {
  let repo: jest.Mocked<FxRepository>;
  let provider: jest.Mocked<FxRateProvider>;
  let service: FxService;

  beforeEach(() => {
    repo = {
      findByBase: jest.fn().mockResolvedValue([]),
      replace: jest.fn(),
    } as unknown as jest.Mocked<FxRepository>;
    provider = {
      fetchLatest: jest.fn().mockResolvedValue({ date: '2026-10-29', rates: { EUR: 0.9 } }),
    };
    service = new FxService(repo, provider);
  });

  it('serves fresh cached rates without calling the provider', async () => {
    repo.findByBase.mockResolvedValue([row('EUR', '0.9')]);
    expect((await service.getRates('usd')).rates).toEqual({ EUR: 0.9 });
    expect(provider.fetchLatest).not.toHaveBeenCalled();
  });

  it('refreshes stale rates and stores them', async () => {
    repo.findByBase.mockResolvedValue([row('EUR', '0.8', 13 * 3600_000)]);
    expect((await service.getRates('USD')).rates).toEqual({ EUR: 0.9 });
    expect(repo.replace).toHaveBeenCalledWith('USD', '2026-10-29', { EUR: 0.9 });
  });

  it('falls back to stale rates when the provider is down', async () => {
    repo.findByBase.mockResolvedValue([row('EUR', '0.8', 13 * 3600_000)]);
    provider.fetchLatest.mockRejectedValue(new Error('down'));
    expect((await service.getRates('USD')).rates).toEqual({ EUR: 0.8 });
  });

  it('reports unavailable when there is nothing cached and the provider is down', async () => {
    provider.fetchLatest.mockRejectedValue(new Error('down'));
    await expect(service.getRates('USD')).rejects.toThrow(ServiceUnavailableException);
  });

  it('converts minor units and rejects unknown currencies', async () => {
    expect(await service.convertMinor(1000, 'USD', 'EUR')).toBe(900);
    expect(await service.convertMinor(1000, 'USD', 'usd')).toBe(1000);
    await expect(service.convertMinor(1000, 'USD', 'XXX')).rejects.toThrow(BadRequestException);
  });

  it('rejects malformed currency codes', async () => {
    await expect(service.getRates('DOLLARS')).rejects.toThrow(BadRequestException);
  });
});
