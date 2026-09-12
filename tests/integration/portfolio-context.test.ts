/** @jest-environment node */
import { POST } from "@/app/api/portfolio/context/route";
import { initialHoldings } from "@/lib/finance/portfolio-engine";
const context = {
  holdings: initialHoldings,
  range: [700, 730],
  timeframe: "1M",
  benchmark: "spy",
  compare: "",
  mode: "performance",
  showBenchmark: true,
  selected: null,
};
const request = (body: unknown) =>
  POST(
    new Request("http://localhost/api/portfolio/context", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
test("derives explanations from validated context and reacts to point, asset and mode", async () => {
  const basic = await (await request(context)).json();
  expect(basic.mode).toBe("deterministic");
  const compared = await (await request({ ...context, compare: "btc" })).json();
  expect(compared.headline).toBe("BTC a portfolio");
  expect(compared.summary).toContain("indexu 100");
  const selected = await (await request({ ...context, selected: 0 })).json();
  expect(selected.context).toBe("Vybraný bod");
  expect(selected.summary).toContain("0,0 %");
  const downside = await (await request({ ...context, mode: "drawdown" })).json();
  expect(downside.summary).toContain("pokles");
});
test("rejects PII, unknown assets, out-of-range selections and inverted ranges", async () => {
  for (const change of [
    { email: "person@example.test" },
    { compare: "made-up" },
    { selected: 31 },
    { range: [720, 710] },
  ])
    expect((await request({ ...context, ...change })).status).toBe(400);
});
