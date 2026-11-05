"use client";
import { LocalizedText, useLanguage } from "@/components/i18n-provider";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import type { Asset } from "@/lib/market";
import { formatAssetValue } from "@/lib/market-display";

type Props = { onSelect: (asset: Asset) => void; currency: string; rate: number; placeholder?: string };
export default function CryptoAssetSearch({ onSelect, currency, rate, placeholder = "Search all CoinGecko coins…" }: Props) {
  const { t: translateUI } = useLanguage();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Asset[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (query.trim().length < 1) { setResults([]); setBusy(false); setError(null); return; }
      setBusy(true); setError(null);
      fetch(`/api/crypto/assets?search=${encodeURIComponent(query.trim())}&perPage=8`, { signal: controller.signal })
        .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Search unavailable"); return data; })
        .then(data => { setResults(Array.isArray(data.assets) ? data.assets : []); setOpen(true); })
        .catch(err => { if (err.name !== "AbortError") { setError(err.message ?? "Search unavailable"); setResults([]); } })
        .finally(() => setBusy(false));
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  return <div className="cg-search">
    <div className="explorer-search"><Search size={17}/><input aria-label={translateUI("Search all CoinGecko coins")} placeholder={placeholder} value={query} onChange={event => { setQuery(event.target.value); setOpen(true); }}/>{query && <button aria-label={translateUI("Clear coin search")} onClick={() => { setQuery(""); setResults([]); }}><X size={15}/></button>}</div>
    {open && (query.trim() || busy || error) && <div className="cg-search-results" role="listbox">
      {busy && <div className="cg-search-note">{<LocalizedText text={"Searching CoinGecko…"}/>}</div>}
      {error && <div className="cg-search-note negative-text">{error}</div>}
      {!busy && !error && !results.length && query.trim() && <div className="cg-search-note">{<LocalizedText text={"No matching coins."}/>}</div>}
      {results.map(asset => <button key={asset.id} role="option" aria-selected={false} onClick={() => { onSelect(asset); setQuery(""); setResults([]); setOpen(false); }}>
        <span className="cg-icon" role="img" aria-label={asset.name} style={asset.image ? { backgroundImage: `url(${asset.image})` } : undefined}>{!asset.image && asset.mark}</span>
        <span><strong>{asset.name}</strong><small>{asset.displaySymbol}</small></span>
        <em>{formatAssetValue(asset, asset.price > 0 ? asset.price : null, currency, rate)}</em>
      </button>)}
    </div>}
  </div>;
}
