import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IndustryCompanies } from "@/components/markets/IndustryCompanies";
import { buildIndustryOverview } from "@/lib/finance/industry-overview";
import { marketThemes } from "@/data/market-themes";
import { industryCompanies } from "@/data/market-industries";

test("company directory filters size, searches names, sorts and preserves asset links", async () => {
  const theme = marketThemes[0];
  const overview = buildIndustryOverview(industryCompanies(theme), theme.constituents, new Map(), { from: "2026-09-01", to: "2026-09-25", interval: "1day" });
  const user = userEvent.setup();
  render(<IndustryCompanies overview={overview} timeframe="1M" locale="cs-CZ" />);
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(19);
  await user.selectOptions(screen.getByLabelText("Velikost firmy"), "Small");
  const expected = overview.rows.filter((row) => row.size === "Small");
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(expected.length + 1);
  await user.selectOptions(screen.getByLabelText("Velikost firmy"), "all");
  await user.type(screen.getByLabelText("Hledat firmu"), "NVIDIA");
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  expect(screen.getByRole("link", { name: /NVDA/ })).toHaveAttribute("href", `/${"cs-CZ"}/assets/${encodeURIComponent(theme.constituents[0].id)}`);
  await user.clear(screen.getByLabelText("Hledat firmu"));
  await user.selectOptions(screen.getByLabelText("Řadit firmy"), "name");
  expect(within(screen.getByRole("table")).getAllByRole("row")[1]).toHaveTextContent("Adobe");
  await user.type(screen.getByLabelText("Hledat firmu"), "no-such-company");
  expect(screen.getByRole("status")).toHaveTextContent("Žádná firma");
});
