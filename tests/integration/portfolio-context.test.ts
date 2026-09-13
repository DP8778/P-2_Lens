/** @jest-environment node */
import { POST } from "@/app/api/portfolio/context/route";
import { initialTransactions, timeline } from "@/lib/finance/portfolio-engine";

const context = {
  transactions: initialTransactions,
  selectedRange: [timeline[700], timeline[730]],
  timeframe: "1M",
  benchmarkId: "spy",
  compareAssetId: "",
  mode: "performance",
  showBenchmark: true,
  selectedPoint: null,
};
const request = (body: unknown) =>
  POST(
    new Request("http://localhost/api/portfolio/context", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

test("odvozuje vysvětlení z validovaného analytického kontextu", async () => {
  const basic = await (await request(context)).json();
  expect(basic.mode).toBe("deterministic");
  expect(basic.scopeLabel).toContain("2026");
  expect(basic.evidence.length).toBeGreaterThan(0);
  const compared = await (await request({ ...context, compareAssetId: "btc" })).json();
  expect(compared.headline).toContain("BTC");
  const selected = await (await request({ ...context, selectedPoint: timeline[700] })).json();
  expect(selected.evidence.some((item: { id: string }) => item.id === "selected-point-value")).toBe(
    true,
  );
  const downside = await (await request({ ...context, mode: "drawdown" })).json();
  expect(downside.summary).toContain("pokles");
  const custom = await (
    await request({ ...context, selectedRange: [timeline[710], timeline[720]] })
  ).json();
  expect(custom.scopeLabel).toContain("2026");
  expect(custom.scopeLabel).not.toBe(basic.scopeLabel);
});

test("odmítá PII, neznámá aktiva a body mimo období", async () => {
  for (const change of [
    { email: "person@example.test" },
    { compareAssetId: "made-up" },
    { selectedPoint: timeline[699] },
    { selectedRange: [timeline[720], timeline[710]] },
  ])
    expect((await request({ ...context, ...change })).status).toBe(400);
});
