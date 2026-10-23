/** Public-source snapshot publisher. No price-provider calls or API credentials. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { rankIndustryMembers } from '../src/lib/finance/industry-data.ts';
import { tableRows, compactNumber, parseIncomeStatement, parseRevenueSegments, parseSecAnnual, mergeFinancialHistory } from '../src/lib/finance/fundamentals-normalizers.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(root, 'src/lib/fundamentals/snapshots');
const now = new Date().toISOString();
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const userAgent = process.env.LENS_DATA_USER_AGENT;
const cacheDir = resolve(root, '.cache/lens-source-data');
await mkdir(cacheDir, { recursive: true });
async function download(url) {
  const filename = resolve(cacheDir, hash(url));
  if (process.argv.includes('--reuse-downloads')) {
    try { const record = JSON.parse(await readFile(filename, 'utf8')); if (Date.now() - Date.parse(record.at) < 86400000) return record.body; } catch { /* fetch normally */ }
  }
  const response = await fetch(url, { headers: userAgent ? { 'User-Agent': userAgent } : undefined, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const body = await response.text();
  await writeFile(filename, JSON.stringify({ at: now, body }));
  return body;
}
function csvRows(text) {
  return text.trim().split(/\r?\n/).map((line) => [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map(([ , value]) => value.replace(/^"|"$/g, '').replace(/""/g, '"')));
}
function listingsFrom(text, other = false) {
  const [headers, ...rows] = text.trim().split(/\r?\n/).map((row) => row.split('|'));
  return rows.flatMap((row) => {
    const r = Object.fromEntries(headers.map((key, i) => [key, row[i]]));
    const symbol = other ? r['ACT Symbol'] : r.Symbol;
    if (!symbol || r['Test Issue'] !== 'N' || r.ETF !== 'N' || !/^[A-Z]{1,5}$/.test(symbol) || /preferred|warrant|unit[s ]|right[s ]|note[s ]|debenture|depositary shares/i.test(r['Security Name'])) return [];
    const micCode = other ? ({N:'XNYS', A:'XASE', P:'ARCX'}[r.Exchange]) : ({Q:'XNGS',G:'XNGM',S:'XNCM'}[r['Market Category']]);
    if (!micCode) return [];
    return [[symbol, { id: `twelvedata:${micCode}:${symbol}`, provider: 'twelvedata', providerSymbol: symbol, symbol, name: r['Security Name'], type: 'stock', exchange: other ? 'NYSE' : 'NASDAQ', micCode, currency: 'USD' }]];
  });
}
const nasdaqUrl='https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt';
const otherUrl='https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt';
const nasdaq=await download(nasdaqUrl), other=await download(otherUrl);
const listings = new Map([...listingsFrom(nasdaq), ...listingsFrom(other,true)]);
if (listings.size < 2000) throw new Error('Listing feed unexpectedly incomplete; current snapshot preserved');
const feeds = {};
for (const fund of ['aiq','dtcr','chpx','clou','bug']) {
  const page=`https://www.globalxetfs.com/funds/${fund}/`;
  const html=await download(page);
  const url=html.match(new RegExp(`https://assets\\.globalxetfs\\.com/funds/holdings/${fund}_full-holdings_\\d{8}\\.csv`))?.[0];
  if (!url) throw new Error(`Missing holdings URL for ${fund}`);
  const csv=await download(url); const rows=csvRows(csv); const header=rows.findIndex((row)=>row.includes('Ticker'));
  if(header<0) throw new Error(`Invalid holdings for ${fund}`);
  const symbols=rows.slice(header+1).map((row)=>row[rows[header].indexOf('Ticker')]).filter(Boolean);
  if(symbols.length<10) throw new Error(`Incomplete holdings for ${fund}`);
  feeds[fund]={symbols,url,date:csv.match(/as of ([\d/]+)/)?.[1] ?? now.slice(0,10)};
}
const semiUrl='https://stockanalysis.com/stocks/industry/semiconductors/';
const semiRows=tableRows(await download(semiUrl));
const symbolsFromTable=(rows)=>rows.filter((row)=>/^\d+$/.test(row[0])).map((row)=>row[1]);
if(symbolsFromTable(semiRows).length<20) throw new Error('Semiconductor classification incomplete');
const definitions={ai:['aiq'], 'ai-infrastructure':['dtcr','chpx'], semiconductors:[], 'saas-cloud':['clou'], cybersecurity:['bug']};
const candidates=Object.fromEntries(Object.entries(definitions).map(([id,funds])=>[id, id==='semiconductors'?symbolsFromTable(semiRows):funds.flatMap((fund)=>feeds[fund].symbols)]));
const capData=new Map();
for(const sector of ['technology','communication-services','consumer-discretionary','real-estate','industrials','financials']) {
  const url=`https://stockanalysis.com/stocks/sector/${sector}/`;
  const rows=tableRows(await download(url));
  if(rows.length<20) throw new Error(`Capitalization source incomplete: ${sector}`);
  for(const row of rows) { const value=compactNumber(row[3] ?? ''); if(value && /^[A-Z]{1,5}$/.test(row[1])) capData.set(row[1],{value,name:row[2],source:url}); }
}
let previous;
try { previous=JSON.parse(await readFile(resolve(directory,'current.json'),'utf8')); } catch { /* first snapshot */ }
const industries={};
for(const [id,symbols] of Object.entries(candidates)) {
  const ranked=rankIndustryMembers(symbols,listings,capData);
  if(!ranked.members.length) throw new Error(`No valid members: ${id}`);
  const prior=previous?.industries[id];
  const membershipHash=hash(ranked.members.map((row)=>row.asset.id));
  const sources=id==='semiconductors'?[semiUrl]:definitions[id].map((fund)=>feeds[fund].url);
  industries[id]={id,...ranked,version:hash({members:ranked.members,sources}),updatedAt:now,
    rebalancedAt:prior && hash(prior.members.map((row)=>row.asset.id))===membershipHash?prior.rebalancedAt:now,
    sources:[...sources,nasdaqUrl,otherUrl],sourceDates:Object.fromEntries(id==='semiconductors'?[[semiUrl,now.slice(0,10)]]:definitions[id].map((fund)=>[feeds[fund].url,feeds[fund].date]))};
  console.log(`${id}: ${ranked.members.length}/100 members from ${ranked.candidateCount} candidates`);
}
const companies=[...new Map(Object.values(industries).flatMap((industry)=>industry.members.map((row)=>[row.asset.symbol,row.asset]))).values()];
const fundamentals={};
for(const asset of companies) {
  const source=`https://stockanalysis.com/stocks/${asset.symbol.toLowerCase()}/financials/income-statement/`;
  try {
    const html=await download(source);
    const statements=parseIncomeStatement(html,asset,source);
    if(!statements.length) throw new Error('No complete reconciled annual USD statements');
    // Revenue segments are separate reported dimensions, never inferred from a company name.
    try {
      const segmentSource=`https://stockanalysis.com/stocks/${asset.symbol.toLowerCase()}/financials/`;
      const segments=parseRevenueSegments(await download(segmentSource));
      for(const statement of statements) {
        const reported=segments.get(statement.period);
        if(reported?.length && Math.abs(reported.reduce((sum,row)=>sum+row.revenue,0)-statement.revenue)<=Math.max(1,statement.revenue*0.00001)) {
          statement.segments=reported; statement.segmentSource=segmentSource;
        }
      }
    } catch { /* absent segments remain unavailable */ }
    fundamentals[asset.symbol]={symbol:asset.symbol,provider:'stock-analysis',fetchedAt:now,statements:mergeFinancialHistory(previous?.fundamentals[asset.symbol]?.statements ?? [],statements)};
  } catch(error) {
    const old=previous?.fundamentals[asset.symbol];
    fundamentals[asset.symbol]=old?{...old,errors:[error.message]}:{symbol:asset.symbol,provider:'stock-analysis',fetchedAt:now,statements:[],errors:[error.message]};
  }
  console.log(`fundamentals ${asset.symbol}: ${fundamentals[asset.symbol].statements.length} years`);
}
// Primary-source enhancement: annual iXBRL, including independently reported expense categories.
const pltr=companies.find((asset)=>asset.symbol==='PLTR');
if(pltr) {
  const source='https://www.sec.gov/Archives/edgar/data/1321655/000132165526000011/pltr-20251231.htm';
  try {
    const reports=parseSecAnnual(await download(source),pltr,source);
    if(!reports.length) throw new Error('No valid primary-source PLTR statements');
    const record=fundamentals.PLTR;
    const merged=new Map(record.statements.map((statement)=>[statement.period,statement]));
    for(const statement of reports) merged.set(statement.period,{...merged.get(statement.period),...statement,...(statement.segments ? { segmentSource: source } : {})});
    fundamentals.PLTR={symbol:'PLTR',provider:'sec-ixbrl + stock-analysis',fetchedAt:now,statements:[...merged.values()].sort((a,b)=>b.period.localeCompare(a.period))};
  } catch(error) { fundamentals.PLTR.errors=[...(fundamentals.PLTR.errors??[]),`SEC enrichment: ${error.message}`]; }
}
const version=hash({industries,fundamentals});
const snapshot={schemaVersion:1,version,updatedAt:now,industries,fundamentals};
await mkdir(directory,{recursive:true});
await mkdir(resolve(directory,'memberships'),{recursive:true});
for (const industry of Object.values(industries)) {
  try { await writeFile(resolve(directory,'memberships',`${industry.id}-${industry.version}.json`),JSON.stringify(industry,null,2)+'\n',{flag:'wx'}); }
  catch(error) { if(error.code!=='EEXIST') throw error; }
}
await writeFile(resolve(directory,'current.json.tmp'),JSON.stringify(snapshot,null,2)+'\n');
await rename(resolve(directory,'current.json.tmp'),resolve(directory,'current.json'));
console.log(`Published ${version}: ${companies.length} companies, ${Object.values(fundamentals).filter((row)=>row.statements.length).length} with annual financials`);
