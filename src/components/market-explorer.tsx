"use client";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, ChevronDown, Globe, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { ASSET_CLASSES, classInfo, type AssetClass } from "@/lib/instruments";
import type { Asset } from "@/lib/market";
import { feedLabel, formatAssetChange, formatAssetValue } from "@/lib/market-display";

type Props = {
  assets: Asset[];
  watchlist: string[];
  watchlistBusy: string | null;
  onWatchlist: (symbol: string) => void;
  onSelect: (symbol: string) => void;
  search: string;
  onSearch: (value: string) => void;
  currency: string;
  rate: number;
  demo: boolean;
};
export default function MarketExplorer({ assets, watchlist, watchlistBusy, onWatchlist, onSelect, search, onSearch, currency, rate, demo }: Props) {
  const [category, setCategory] = useState<AssetClass | "all">("all");
  const [view, setView] = useState("All");
  const [sort, setSort] = useState("catalog");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = assets.filter(asset =>
      (category === "all" || asset.assetClass === category) &&
      (!query || `${asset.name} ${asset.symbol} ${asset.displaySymbol} ${classInfo(asset.assetClass).label}`.toLowerCase().includes(query)) &&
      (view === "Watchlist" ? watchlist.includes(asset.symbol) : view === "Tradable" ? asset.tradable : view === "Gainers" ? (asset.change ?? 0) > 0 : view === "Losers" ? (asset.change ?? 0) < 0 : true));
    if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "change") result.sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity));
    return result;
  }, [assets, category, search, view, sort, watchlist]);
  const related = category === "bond" || category === "index" ? assets.filter(asset => asset.tradable && asset.relatedSymbols.some(symbol => assets.some(reference => reference.symbol === symbol && reference.assetClass === category))) : [];
  const reset = () => { setCategory("all"); setView("All"); setSort("catalog"); onSearch(""); };
  return <div className="market-explorer">
    <section className="explorer-intro">
      <div><span className="eyebrow">MULTI-ASSET EXPLORER</span><h2>One workspace. Seven markets.</h2><p>Explore companies, currencies, commodities, funds, and benchmarks in one paper-trading portfolio.</p></div>
      <div className="explorer-counts"><div><strong>{assets.filter(a => a.tradable).length}</strong><span>tradable instruments</span></div><div><strong>{assets.filter(a => !a.tradable).length}</strong><span>reference benchmarks</span></div></div>
    </section>
    <div className="asset-class-grid" aria-label="Asset classes">
      <button className={`asset-class-card ${category === "all" ? "selected" : ""}`} onClick={() => setCategory("all")} aria-pressed={category === "all"}><span className="class-card-icon"><Globe size={19}/></span><strong>All markets</strong><small>{assets.length} instruments</small><ArrowUpRight size={15}/></button>
      {ASSET_CLASSES.map(info => <button key={info.id} className={`asset-class-card ${category === info.id ? "selected" : ""}`} style={{ "--class-color": info.color } as React.CSSProperties} onClick={() => setCategory(info.id)} aria-pressed={category === info.id}><span className="class-card-icon">{info.id === "bond" ? "%" : info.label.slice(0, 1)}</span><strong>{info.label}</strong><small>{assets.filter(a => a.assetClass === info.id).length} instruments</small><ArrowUpRight size={15}/></button>)}
    </div>
    {category !== "all" && <div className="class-context"><BookOpen size={17}/><span>{classInfo(category).description}</span></div>}
    {related.length > 0 && <section className="related-etfs"><div><span className="eyebrow">SIMULATED EXPOSURE</span><h3>{category === "bond" ? "Explore bond ETFs" : "Explore equity-index ETFs"}</h3><p>{category === "bond" ? "A bond ETF is a tradable fund, not a promise to repay principal. Its value can rise or fall." : "An ETF is a separate fund share. Its tracking objective and index may differ from the benchmarks shown here."}</p></div><div className="related-etf-list">{related.map(asset => <button key={asset.symbol} onClick={() => onSelect(asset.symbol)}><span><strong>{asset.symbol}</strong><small>{asset.name}</small></span><ArrowRight size={17}/></button>)}</div></section>}
    <section className="panel explorer-table-panel">
      <div className="explorer-toolbar"><div className="explorer-search"><Search size={18}/><input aria-label="Search instruments" placeholder="Search names, symbols, or asset classes…" value={search} onChange={event => onSearch(event.target.value)}/>{search && <button aria-label="Clear search" onClick={() => onSearch("")}><X size={15}/></button>}</div><div className="explorer-sort"><SlidersHorizontal size={15}/><select aria-label="Sort instruments" value={sort} onChange={event => setSort(event.target.value)}><option value="catalog">Catalog order</option><option value="name">Name A–Z</option><option value="change">Largest change</option></select><ChevronDown size={14}/></div><button className="text-link" onClick={reset}>Reset filters</button></div>
      <div className="explorer-view-row"><div className="segmented">{["All", "Tradable", "Gainers", "Losers", "Watchlist"].map(item => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}{item === "Watchlist" ? ` (${watchlist.length})` : ""}</button>)}</div><span>{filtered.length} results</span></div>
      <div className="table-scroll"><table className="data-table explorer-table"><thead><tr><th aria-label="Watchlist"/><th>Instrument</th><th>Asset class</th><th>{category === "bond" ? "Yield" : "Price / level"}</th><th>Change</th><th>Data feed</th><th aria-label="Open instrument"/></tr></thead><tbody>
        {filtered.map(asset => <tr key={asset.id} className="clickable-row" onClick={() => onSelect(asset.symbol)}>
          <td><button className="icon-btn explorer-star" aria-label={`${watchlist.includes(asset.symbol) ? "Remove" : "Add"} ${asset.displaySymbol} ${watchlist.includes(asset.symbol) ? "from" : "to"} watchlist`} disabled={watchlistBusy === asset.symbol} onClick={event => { event.stopPropagation(); onWatchlist(asset.symbol); }}><Star size={16} fill={watchlist.includes(asset.symbol) ? "#e9ac38" : "none"} color={watchlist.includes(asset.symbol) ? "#e9ac38" : "currentColor"}/></button></td>
          <td><div className="coin-cell"><span className="asset-icon explorer-asset-icon" style={{ background: asset.image ? `center / cover no-repeat url(${asset.image})` : asset.color }}>{!asset.image && asset.mark}</span><div><strong>{asset.name}</strong><span>{asset.displaySymbol} · {asset.exchange}</span></div></div></td>
          <td><span className="class-badge" style={{ "--class-color": classInfo(asset.assetClass).color } as React.CSSProperties}>{classInfo(asset.assetClass).label}</span></td>
          <td className="table-strong">{formatAssetValue(asset, asset.price > 0 ? asset.price : null, currency, rate)}</td>
          <td><span className={(asset.change ?? 0) >= 0 ? "positive-text" : "negative-text"}>{formatAssetChange(asset, asset.change)}</span>{asset.valueKind === "yield" && <small className="feed-detail">vs. prior observation</small>}</td>
          <td><span className={`feed-badge ${asset.quoteStatus}`}><i/>{feedLabel(asset)}</span><small className="feed-detail">{demo ? "Synthetic fixture" : asset.source}</small></td>
          <td><button className="table-trade" onClick={event => { event.stopPropagation(); onSelect(asset.symbol); }}>{asset.tradable ? "View / trade" : "Explore"}<ArrowUpRight size={14}/></button></td>
        </tr>)}
      </tbody></table>{!filtered.length && <div className="explorer-empty"><Search size={25}/><h3>{view === "Watchlist" ? "No saved instruments here" : "No matching instruments"}</h3><p>{view === "Watchlist" ? "Use the star beside an instrument to save it." : "Try another search or reset your filters."}</p><button className="outline-btn small" onClick={reset}>Show all markets</button></div>}</div>
      <div className="explorer-footnote"><span>{demo ? "Demo prices and charts are synthetic—not current or historical market data." : "Quotes are indicative. Availability, latency, and market hours depend on your data entitlement."}</span><span>No real orders are sent.</span></div>
    </section>
  </div>;
}
