import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { IndustryCompanies } from "@/components/markets/IndustryCompanies";
import { buildIndustryOverview } from "@/lib/finance/industry-overview";
import { marketThemes } from "@/data/market-themes";
import { industryCompanies } from "@/data/market-industries";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));

test("clicking a company row outside its link and pressing Enter navigate to existing Asset Detail", async () => {
  const push = jest.fn();
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  const theme = marketThemes[0];
  const overview = buildIndustryOverview(industryCompanies(theme), theme.constituents, new Map(), { from: "2026-09-01", to: "2026-09-25", interval: "1day" });
  const user = userEvent.setup();
  render(<IndustryCompanies overview={overview} timeframe="1M" locale="cs-CZ" />);
  await user.type(screen.getByLabelText("Hledat firmu"), "NVDA");
  const row = within(screen.getByRole("table")).getAllByRole("row")[1];
  await user.click(within(row).getByText("NVIDIA Corporation", { selector: "td > span" }));
  const target = `/cs-CZ/assets/${encodeURIComponent(theme.constituents[0].id)}`;
  expect(push).toHaveBeenLastCalledWith(target);
  expect(within(row).getByRole("link")).toHaveAttribute("href", target);
  row.focus();
  await user.keyboard("{Enter}");
  expect(push).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole("button", { name: "Kapitalizace · řadit" }));
  expect(screen.getByRole("columnheader", { name: /Kapitalizace/ })).toHaveAttribute("aria-sort", "ascending");
  await user.click(screen.getByRole("button", { name: "Kapitalizace · řadit" }));
  expect(screen.getByRole("columnheader", { name: /Kapitalizace/ })).toHaveAttribute("aria-sort", "descending");
});
