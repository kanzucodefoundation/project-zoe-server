import { TenantHeaderMiddleware } from './tenant-header.middleware';

describe('TenantHeaderMiddleware', () => {
  it('should be defined', () => {
    expect(new TenantHeaderMiddleware()).toBeDefined();
  });
});
