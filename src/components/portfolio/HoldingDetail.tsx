import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import type { HoldingMetric, Transaction } from "@/lib/finance/portfolio-engine";
import { money, percent, points, allocation, dateLabel } from "@/components/charts/chart-formatters";
import { usePortfolio } from "./PortfolioProvider";

type Trade = Extract<Transaction, { type: "buy" | "sell" }>;
export function HoldingDetail({ holding: p, locale, onClose, onCompare, onAdd }: { holding: HoldingMetric; locale: string; onClose: () => void; onCompare: () => void; onAdd: () => void }) {
  const { mode, market, transactions, remove, saveTrade, removeTransaction } = usePortfolio();
  const trades = transactions.filter((row): row is Trade => "assetId" in row && row.assetId === p.assetId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
  const quote = market.quotes.find((item) => item.assetId === p.assetId);
  const [editor, setEditor] = useState<{ type: "buy" | "sell"; trade?: Trade }>();
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fee, setFee] = useState("0");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const visibleTrades = showAllTransactions ? trades : trades.slice(0, 5);
  const startEditor = (type: "buy" | "sell", trade?: Trade) => {
    setEditor({ type, trade }); setQuantity(trade ? String(trade.quantity) : ""); setPrice(trade ? String(trade.unitPrice) : ""); setDate(trade?.occurredAt ?? new Date().toISOString().slice(0, 10)); setFee(trade ? String(trade.fee) : "0"); setError("");
  };
  const submit = async () => {
    if (!editor) return;
    const input = { quantity: Number(quantity.replace(",", ".")), unitPrice: Number(price.replace(",", ".")), date, fee: Number(fee.replace(",", ".")) };
    if (!Number.isFinite(input.quantity) || input.quantity <= 0 || !Number.isFinite(input.unitPrice) || input.unitPrice <= 0 || !Number.isFinite(input.fee) || input.fee < 0) { setError("Zkontrolujte množství, cenu a poplatek."); return; }
    setPending(true);
    try { await saveTrade(p.assetId, editor.type, input, editor.trade?.id); setNotice(editor.trade ? "Transakce byla upravena." : editor.type === "buy" ? "Nákup byl přidán." : "Prodej byl přidán."); setEditor(undefined); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Transakci se nepodařilo uložit."); }
    finally { setPending(false); }
  };
  return <Dialog open wide title={p.asset.name} onClose={onClose}>
    <div className="holding-detail">
      <div className="selected-asset"><span className="asset-monogram">{p.asset.symbol.slice(0, 2)}</span><span><strong>{p.asset.symbol}</strong><small className="tertiary block">{p.asset.exchange} · {p.asset.currency}</small></span></div>
      <div className="detail-value"><small>Současná hodnota</small><strong>{money(p.marketValue, locale)}</strong>{quote && <span>{quote.price.toLocaleString(locale)} {quote.currency} za jednotku</span>}</div>
      <dl className="detail-metrics">
        <div><dt>Množství</dt><dd>{p.quantity.toLocaleString(locale, { maximumFractionDigits: 8 })}</dd></div>
        <div><dt>Průměrná nákupní cena</dt><dd>{money(p.averageCostCzk, locale)}</dd></div>
        <div><dt>P/L včetně poplatků</dt><dd className={p.pnl >= 0 ? "positive" : "negative"}>{money(p.pnl, locale)} · {percent(p.pnlPct, locale)}</dd></div>
        <div><dt>Alokace</dt><dd>{allocation(p.allocationPct, locale)}</dd></div>
        <div><dt>Příspěvek za období</dt><dd>{points(p.contributionPctPoints, locale)}</dd></div>
      </dl>
      <div className="detail-actions"><button className="primary-button" onClick={onCompare}>Porovnat v grafu</button>{mode === "personal" && <><button className="quiet-button" onClick={onAdd}>Přidat nákup</button><button className="quiet-button" onClick={() => startEditor("sell")}>Přidat prodej</button></>}</div>
      {notice && <p role="status" className="trade-notice">{notice}</p>}
      {editor && <div className="trade-editor"><h3>{editor.trade ? "Upravit transakci" : editor.type === "buy" ? "Přidat nákup" : "Přidat prodej"}</h3><div className="position-fields"><label>Množství<input aria-label="Množství transakce" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>{editor.type === "buy" ? "Nákupní cena" : "Prodejní cena"}<input value={price} onChange={(event) => setPrice(event.target.value)} /></label><label>Datum<input type="date" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Poplatek · {p.asset.currency}<input value={fee} onChange={(event) => setFee(event.target.value)} /></label></div>{error && <p role="alert" className="form-error">{error}</p>}<div className="dialog-actions"><button className="quiet-button" onClick={() => setEditor(undefined)}>Zrušit</button><button className="primary-button" disabled={pending} onClick={() => void submit()}>{pending ? "Ověřuji data…" : "Uložit transakci"}</button></div></div>}
      {mode === "personal" && <section className="transaction-history"><h3>Historie transakcí <span>{trades.length}</span></h3>{visibleTrades.map((trade) => <div key={trade.id} className="transaction-row"><span><strong>{trade.type === "buy" ? "Nákup" : "Prodej"}</strong><small>{dateLabel(trade.occurredAt, locale)}</small></span><span>{trade.quantity.toLocaleString(locale)} {p.asset.symbol} @ {trade.unitPrice.toLocaleString(locale)} {trade.currency}</span><span><button onClick={() => startEditor(trade.type, trade)}>Upravit</button><button onClick={() => { removeTransaction(trade.id); setNotice("Transakce byla odstraněna."); }}>Odstranit</button></span></div>)}{trades.length > 5 && <button className="transaction-disclosure" aria-expanded={showAllTransactions} onClick={() => setShowAllTransactions((value) => !value)}>{showAllTransactions ? "Zobrazit posledních 5" : `Zobrazit všechny (${trades.length})`}</button>}</section>}
      {mode === "personal" && <button className="remove-link" onClick={() => { remove(p.assetId); onClose(); }}>Odebrat celou pozici</button>}
      {mode === "demo" && <p className="inline-notice">Demo portfolio je read-only analytický scénář.</p>}
    </div>
  </Dialog>;
}
