import { nameTenantHeaderMiddleware } from "./nameTenantHeader.middleware";

describe("nameTenantHeaderMiddleware", () => {
  it("should be defined", () => {
    expect(new nameTenantHeaderMiddleware()).toBeDefined();
  });
});
