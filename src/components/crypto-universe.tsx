"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, ExternalLink, Globe, RefreshCw, Search, Star, TrendingUp, X } from "lucide-react";
import type { Asset } from "@/lib/market";
import { formatAssetChange, formatAssetValue } from "@/lib/market-display";

type Props = { onTrade: (asset: Asset) => void; onWatchlist: (symbol: string) => void; watchlist: string[]; watchlistBusy: string | null; currency: string; rate: number };
type CoinPage = { assets: Asset[]; total: number | null; page: number; perPage: number; updatedAt: string };
type Discovery = { trending: { id: string; name: string; symbol: string; image: string | null; rank: number | null; asset: Asset }[]; categories: Record<string, unknown>[]; exchanges: Record<string, unknown>[]; global: Record<string, unknown>; updatedAt: string };
type CoinDetail = { asset: Asset; detail: { description: string; categories: string[]; platforms: Record<string, string>; homepage: string[]; blockchainSites: string[]; tickers: Record<string, unknown>[] } };
const num = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
const str = (value: unknown): string => typeof value === "string" ? value : "";

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <span className="muted-cell">—</span>;
  const min = Math.min(...points), max = Math.max(...points), range = max - min || 1;
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${(index / (points.length - 1)) * 100},${30 - ((point - min) / range) * 28}`).join(" ");
  const up = points.at(-1)! >= points[0];
  return <svg className="cg-sparkline" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><path d={path} fill="none" stroke={up ? "#16a37b" : "#e5484d"} strokeWidth="1.6"/></svg>;
}
function Icon({ asset, size = 32 }: { asset: Asset; size?: number }) {
  return <span className="cg-icon" role="img" aria-label={asset.name} style={{ width: size, height: size, ...(asset.image ? { backgroundImage: `url(${asset.image})` } : { background: asset.color }) }}>{!asset.image && asset.mark}</span>;
}

export default function CryptoUniverse({ onTrade, onWatchlist, watchlist, watchlistBusy, currency, rate }: Props) {
  const [tab, setTab] = useState<"coins" | "trending" | "categories" | "exchanges">("coins");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [order, setOrder] = useState("market_cap_desc");
  const [data, setData] = useState<CoinPage | null>(null);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CoinDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const perPage = 50;
  const compact = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }), [currency]);
  const fiat = (value: number | null) => value === null ? "—" : compact.format(value * rate);

  useEffect(() => {
    if (tab !== "coins") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true); setError(null);
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage), order });
      if (search.trim()) params.set("search", search.trim());
      if (category) params.set("category", category);
      fetch(`/api/crypto/assets?${params}`, { signal: controller.signal })
        .then(async response => { const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Catalog unavailable"); return json as CoinPage; })
        .then(json => setData(json))
        .catch(err => { if (err.name !== "AbortError") setError(err.message ?? "Catalog unavailable"); })
        .finally(() => setBusy(false));
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [tab, search, page, category, order]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/crypto/discovery", { signal: controller.signal })
        .then(async response => { const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Discovery unavailable"); return json as Discovery; })
        .then(setDiscovery)
        .catch(err => { if (err.name !== "AbortError") setError(err.message ?? "Discovery unavailable"); });
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setDetailBusy(true); setDetail(null);
      fetch(`/api/crypto/coin/${encodeURIComponent(selected)}`, { signal: controller.signal })
        .then(async response => { const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Coin unavailable"); return json as CoinDetail; })
        .then(setDetail)
        .catch(err => { if (err.name !== "AbortError") setError(err.message ?? "Coin unavailable"); })
        .finally(() => setDetailBusy(false));
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [selected]);

  const global = discovery?.global ?? {};
  const totalCap = num((global.total_market_cap as Record<string, unknown> | undefined)?.usd);
  const totalVolume = num((global.total_volume as Record<string, unknown> | undefined)?.usd);
  const btcDominance = num((global.market_cap_percentage as Record<string, unknown> | undefined)?.btc);
  const capChange = num(global.market_cap_change_percentage_24h_usd);
  const activeCoins = num(global.active_cryptocurrencies);
  const maxPage = data?.total ? Math.max(1, Math.ceil(data.total / perPage)) : null;
  const categories = discovery?.categories ?? [];
  const refresh = () => { setPage(1); setSearch(""); setCategory(""); setTab("coins"); setError(null); setData(null); };

  return <div className="cg-universe">
    <section className="explorer-intro cg-intro">
      <div><span className="eyebrow">COINGECKO UNIVERSE</span><h2>Every listed crypto market.</h2><p>Search the full CoinGecko catalog, inspect icons and metadata, discover trending coins/categories/exchanges, and paper-trade any coin with a fresh quote.</p></div>
      <div className="explorer-counts"><div><strong>{activeCoins ? activeCoins.toLocaleString("en-US") : data?.total?.toLocaleString("en-US") ?? "—"}</strong><span>listed coins</span></div><div><strong>{discovery?.exchanges.length ?? "—"}</strong><span>tracked exchanges</span></div></div>
    </section>
    <div className="cg-global-stats">
      <div><span>Total market cap</span><strong>{fiat(totalCap)}</strong>{capChange !== null && <em className={capChange >= 0 ? "positive-text" : "negative-text"}>{capChange >= 0 ? "+" : ""}{capChange.toFixed(2)}% 24h</em>}</div>
      <div><span>24h volume</span><strong>{fiat(totalVolume)}</strong></div>
      <div><span>BTC dominance</span><strong>{btcDominance === null ? "—" : `${btcDominance.toFixed(1)}%`}</strong></div>
      <div><span>Data source</span><strong>CoinGecko</strong><em>{discovery?.updatedAt ? new Date(discovery.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "Loading…"}</em></div>
    </div>
    <div className="cg-tabs segmented">{([["coins", "All coins"], ["trending", "Trending"], ["categories", "Categories"], ["exchanges", "Exchanges"]] as const).map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => { setTab(id); setError(null); }}>{label}</button>)}<button className="cg-refresh" onClick={refresh} aria-label="Refresh catalog"><RefreshCw size={15}/></button></div>
    {error && <div className="market-demo-banner cg-error">{error}</div>}

    {tab === "coins" && <section className="panel explorer-table-panel">
      <div className="explorer-toolbar">
        <div className="explorer-search"><Search size={18}/><input aria-label="Search CoinGecko catalog" placeholder="Search name, ticker, or CoinGecko id…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }}/>{search && <button aria-label="Clear search" onClick={() => { setSearch(""); setPage(1); }}><X size={15}/></button>}</div>
        <select aria-label="Filter by category" value={category} onChange={event => { setCategory(event.target.value); setPage(1); }}><option value="">All categories</option>{categories.map(item => <option key={str(item.id)} value={str(item.id)}>{str(item.name)}</option>)}</select>
        <select aria-label="Sort coins" value={order} onChange={event => { setOrder(event.target.value); setPage(1); }}><option value="market_cap_desc">Market cap ↓</option><option value="market_cap_asc">Market cap ↑</option><option value="name_asc">Name A–Z</option></select>
      </div>
      <div className="explorer-view-row"><span>{busy ? "Loading CoinGecko…" : data?.total !== null && data?.total !== undefined ? `${data.total.toLocaleString("en-US")} coins` : `${data?.assets.length ?? 0} coins`}</span><span>Page {page}{maxPage ? ` of ${maxPage}` : ""}</span></div>
      <div className="table-scroll"><table className="data-table cg-table"><thead><tr><th>#</th><th>Coin</th><th>Price</th><th>24h</th><th>7d</th><th>Market cap</th><th>24h volume</th><th>Last 7d</th><th/></tr></thead><tbody>
        {(data?.assets ?? []).map(asset => <tr key={asset.id} className="clickable-row" onClick={() => setSelected(asset.providerSymbol)}>
          <td className="muted-cell">{asset.rank ?? "—"}</td>
          <td><div className="coin-cell"><button className="icon-btn explorer-star" aria-label={`${watchlist.includes(asset.symbol) ? "Remove" : "Add"} ${asset.displaySymbol} ${watchlist.includes(asset.symbol) ? "from" : "to"} watchlist`} disabled={watchlistBusy === asset.symbol} onClick={event => { event.stopPropagation(); onWatchlist(asset.symbol); }}><Star size={15} fill={watchlist.includes(asset.symbol) ? "#e9ac38" : "none"} color={watchlist.includes(asset.symbol) ? "#e9ac38" : "currentColor"}/></button><Icon asset={asset}/><div><strong>{asset.name}</strong><span>{asset.displaySymbol}</span></div></div></td>
          <td className="table-strong">{formatAssetValue(asset, asset.price > 0 ? asset.price : null, currency, rate)}</td>
          <td><span className={(asset.change ?? 0) >= 0 ? "positive-text" : "negative-text"}>{formatAssetChange(asset, asset.change)}</span></td>
          <td><span className={(asset.change7d ?? 0) >= 0 ? "positive-text" : "negative-text"}>{asset.change7d === null ? "—" : `${asset.change7d >= 0 ? "+" : ""}${asset.change7d.toFixed(2)}%`}</span></td>
          <td>{fiat(asset.capUsd)}</td><td>{fiat(asset.volumeUsd)}</td><td><Sparkline points={asset.chart}/></td>
          <td><button className="table-trade" onClick={event => { event.stopPropagation(); onTrade(asset); }}>Trade<ArrowUpRight size={14}/></button></td>
        </tr>)}
      </tbody></table>{!busy && !data?.assets.length && <div className="explorer-empty"><Search size={25}/><h3>No coins found</h3><p>Try another search, category, or refresh the catalog.</p></div>}</div>
      <div className="cg-pagination"><button className="outline-btn small" disabled={page <= 1 || busy} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft size={15}/>Previous</button><button className="outline-btn small" disabled={busy || (maxPage ? page >= maxPage : (data?.assets.length ?? 0) < perPage)} onClick={() => setPage(p => p + 1)}>Next<ChevronRight size={15}/></button></div>
    </section>}

    {tab === "trending" && <section className="panel cg-card-panel"><div className="panel-heading"><div><h3>Trending on CoinGecko</h3><p>Most-searched coins right now.</p></div><TrendingUp size={20}/></div><div className="cg-card-grid">{(discovery?.trending ?? []).map(item => <article key={item.id} className="cg-coin-card"><div className="coin-cell"><Icon asset={item.asset} size={38}/><div><strong>{item.name}</strong><span>{item.symbol.toUpperCase()}{item.rank ? ` · Rank #${item.rank}` : ""}</span></div></div><strong className="cg-card-price">{formatAssetValue(item.asset, item.asset.price > 0 ? item.asset.price : null, currency, rate)}</strong><span className={(item.asset.change ?? 0) >= 0 ? "positive-text" : "negative-text"}>{formatAssetChange(item.asset, item.asset.change)}</span><div className="cg-card-actions"><button className="outline-btn small" onClick={() => setSelected(item.id)}>Details</button><button className="primary-btn small" onClick={() => onTrade(item.asset)}>Trade<ArrowUpRight size={14}/></button></div></article>)}</div>{!discovery?.trending.length && <div className="explorer-empty"><h3>Trending data is loading or unavailable.</h3></div>}</section>}

    {tab === "categories" && <section className="panel explorer-table-panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>Category</th><th>Market cap</th><th>24h</th><th>24h volume</th><th>Top coins</th><th/></tr></thead><tbody>{categories.map(item => <tr key={str(item.id)}><td><strong>{str(item.name)}</strong></td><td>{fiat(num(item.market_cap))}</td><td><span className={(num(item.market_cap_change_24h) ?? 0) >= 0 ? "positive-text" : "negative-text"}>{num(item.market_cap_change_24h) === null ? "—" : `${num(item.market_cap_change_24h)!.toFixed(2)}%`}</span></td><td>{fiat(num(item.total_volume))}</td><td><div className="cg-top-coins">{(Array.isArray(item.top_3_coins) ? item.top_3_coins : []).slice(0, 3).map((url, index) => <span key={index} className="cg-icon tiny" style={{ backgroundImage: `url(${str(url)})` }}/>)}</div></td><td><button className="table-trade" onClick={() => { setCategory(str(item.id)); setTab("coins"); setPage(1); }}>Explore<ArrowUpRight size={14}/></button></td></tr>)}</tbody></table></div></section>}

    {tab === "exchanges" && <section className="panel explorer-table-panel"><div className="panel-heading"><div><h3>Spot exchanges</h3><p>Read-only discovery. Trading happens in the paper simulator, not on these venues.</p></div><Globe size={20}/></div><div className="table-scroll"><table className="data-table"><thead><tr><th>#</th><th>Exchange</th><th>Trust score</th><th>24h volume (BTC)</th><th>Country</th><th>Since</th><th/></tr></thead><tbody>{(discovery?.exchanges ?? []).map(item => <tr key={str(item.id)}><td>{num(item.trust_score_rank) ?? "—"}</td><td><div className="coin-cell"><span className="cg-icon" style={str(item.image) ? { backgroundImage: `url(${str(item.image)})` } : undefined}/><div><strong>{str(item.name)}</strong><span>{str(item.id)}</span></div></div></td><td>{num(item.trust_score) ?? "—"}</td><td>{num(item.trade_volume_24h_btc)?.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? "—"}</td><td>{str(item.country) || "—"}</td><td>{num(item.year_established) ?? "—"}</td><td>{str(item.url) && <a className="table-trade" href={str(item.url)} target="_blank" rel="noreferrer">Site<ExternalLink size={13}/></a>}</td></tr>)}</tbody></table></div></section>}

    {selected && <div className="cg-modal-backdrop" onClick={() => setSelected(null)}><div className="cg-modal panel" role="dialog" aria-modal="true" aria-label="Coin details" onClick={event => event.stopPropagation()}>
      <button className="icon-btn cg-modal-close" aria-label="Close coin details" onClick={() => setSelected(null)}><X size={18}/></button>
      {detailBusy && <div className="explorer-empty"><h3>Loading coin…</h3></div>}
      {detail && <><div className="cg-detail-header"><Icon asset={detail.asset} size={52}/><div><h3>{detail.asset.name}</h3><span>{detail.asset.displaySymbol} · {detail.asset.rank ? `Rank #${detail.asset.rank}` : "Unranked"}</span></div><strong>{formatAssetValue(detail.asset, detail.asset.price > 0 ? detail.asset.price : null, currency, rate)}</strong></div>
        <div className="cg-detail-stats"><div><span>Market cap</span><strong>{fiat(detail.asset.capUsd)}</strong></div><div><span>24h volume</span><strong>{fiat(detail.asset.volumeUsd)}</strong></div><div><span>24h range</span><strong>{formatAssetValue(detail.asset, detail.asset.low24h, currency, rate)} – {formatAssetValue(detail.asset, detail.asset.high24h, currency, rate)}</strong></div></div>
        {detail.detail.description && <p className="cg-description">{detail.detail.description}</p>}
        {detail.detail.categories.length > 0 && <div className="cg-chips">{detail.detail.categories.slice(0, 12).map(item => <button key={item} className="class-badge" onClick={() => { const match = categories.find(c => str(c.name) === item); if (match) { setCategory(str(match.id)); setTab("coins"); setSelected(null); } }}>{item}</button>)}</div>}
        {Object.entries(detail.detail.platforms).filter(([, address]) => address).length > 0 && <div className="cg-contracts"><h4>Contracts</h4>{Object.entries(detail.detail.platforms).filter(([, address]) => address).slice(0, 6).map(([platform, address]) => <div key={platform}><span>{platform}</span><code>{address}</code></div>)}</div>}
        {detail.detail.homepage.length > 0 && <div className="cg-links">{detail.detail.homepage.map(url => <a key={url} href={url} target="_blank" rel="noreferrer">Website<ExternalLink size={13}/></a>)}{detail.detail.blockchainSites.map(url => <a key={url} href={url} target="_blank" rel="noreferrer">Explorer<ExternalLink size={13}/></a>)}</div>}
        {detail.detail.tickers.length > 0 && <div className="table-scroll cg-tickers"><table className="data-table"><thead><tr><th>Market</th><th>Pair</th><th>Last</th><th>Volume</th></tr></thead><tbody>{detail.detail.tickers.slice(0, 10).map((ticker, index) => <tr key={index}><td>{str((ticker.market as Record<string, unknown> | undefined)?.name)}</td><td>{str(ticker.base)}/{str(ticker.target)}</td><td>{num(ticker.last)?.toLocaleString("en-US", { maximumFractionDigits: 8 }) ?? "—"}</td><td>{num(ticker.volume)?.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? "—"}</td></tr>)}</tbody></table></div>}
        <div className="cg-detail-actions"><button className="outline-btn" onClick={() => onWatchlist(detail.asset.symbol)}><Star size={16}/>{watchlist.includes(detail.asset.symbol) ? "Watchlisted" : "Watchlist"}</button><button className="primary-btn" onClick={() => { onTrade(detail.asset); setSelected(null); }}>Paper trade {detail.asset.displaySymbol}<ArrowUpRight size={16}/></button></div>
      </>}
    </div></div>}
  </div>;
}
