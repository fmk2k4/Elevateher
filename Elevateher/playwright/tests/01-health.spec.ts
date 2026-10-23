import { test, expect, request } from "@playwright/test";

const LIVE = !!process.env.RUN_E2E;

test.describe("API health", () => {
  test.skip(!LIVE, "RUN_E2E not set; skipping live API checks");

  test("GET /health responds", async () => {
    const ctx = await request.newContext({ baseURL: "http://localhost:8000" });
    const res = await ctx.get("/health");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/"status"\s*:\s*"(healthy|degraded)"/);
  });

  test("POST /ussd/callback returns CON/END", async () => {
    const ctx = await request.newContext({ baseURL: "http://localhost:8000" });
    const fd = new URLSearchParams();
    fd.set("sessionId", "test-" + Date.now());
    fd.set("serviceCode", "*384#");
    fd.set("phoneNumber", "+60123456789");
    fd.set("text", "");
    const res = await ctx.post("/ussd/callback", {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: fd.toString(),
    });
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/^(CON|END)\b/);
  });
});
