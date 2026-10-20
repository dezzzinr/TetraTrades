"use client";

import { useId, useState, type MouseEvent } from "react";
import { Activity } from "lucide-react";
import { type ChartPeriod, type ChartPoint } from "@/lib/market";
import { formatCompactMoney, formatMarketPrice } from "@/lib/currency";

type Props = {
  points: ChartPoint[];
  period: ChartPeriod;
  status: "loading" | "ready" | "error";
  label: string;
  currency?: string;
  rate?: number;
};

function timeLabel(timestamp: number, period: ChartPeriod) {
  const date = new Date(timestamp);
  if (period === "24H") return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (period === "1Y") return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MarketChart({ points, period, status, label, currency = "USD", rate = 1 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const marketPrice = (value: number) => formatMarketPrice(value, currency, rate);
  const axisPrice = (value: number) => (value >= 1000 ? formatCompactMoney(value, currency, rate) : marketPrice(value));
  const id = useId().replaceAll(":", "");
  if (status === "loading") {
    return <div className="live-chart-state chart-loading"><div className="chart-skeleton"/><span>Loading historical market data…</span></div>;
  }
  if (status === "error" || points.length < 2) {
    return <div className="live-chart-state"><span className="chart-empty-icon"><Activity size={20}/></span><strong>Chart unavailable</strong><span>Historical prices could not be loaded right now.</span></div>;
  }

  const values = points.map((point) => point.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.16 || Math.max(max * 0.025, 0.00001);
  const bottom = Math.max(0, min - pad);
  const top = max + pad;
  const W = 760;
  const H = 192;
  const y = (price: number) => H - ((price - bottom) / (top - bottom)) * H;
  const coords = points.map((point, index) => ({ x: (index / (points.length - 1)) * W, y: y(point.price) }));
  const polyline = coords.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = `M 0 ${H} L ${coords.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" L ")} L ${W} ${H} Z`;
  const positive = values.at(-1)! >= values[0];
  const stroke = positive ? "#3936ee" : "#e86270";
  const active = hover === null ? null : coords[hover];
  const hovered = hover === null ? null : points[hover];
  const ticks = [0, 1, 2, 3].map((index) => top - (index / 3) * (top - bottom));
  const dateTicks = [0, .25, .5, .75, 1].map((fraction) => points[Math.round(fraction * (points.length - 1))]);
  const move = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    setHover(Math.round(fraction * (points.length - 1)));
  };

  return <div className="live-chart" role="img" aria-label={`${label} ${period} historical chart, from ${marketPrice(values[0])} to ${marketPrice(values.at(-1)!)}`}>
    <div className="live-chart-values">{ticks.map((tick, index) => <span key={index}>{axisPrice(tick)}</span>)}</div>
    <div className="live-chart-body">
      <div className="live-chart-plot" onMouseMove={move} onMouseLeave={() => setHover(null)}>
        <div className="live-chart-grid">{ticks.map((_, index) => <span key={index}/>)}</div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="live-chart-svg">
          <defs><linearGradient id={`gradient${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={stroke} stopOpacity=".2"/><stop offset="100%" stopColor={stroke} stopOpacity="0"/></linearGradient></defs>
          <path d={area} fill={`url(#gradient${id})`}/>
          <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
          {active && <circle cx={active.x} cy={active.y} r="5" fill="#fff" stroke={stroke} strokeWidth="3" vectorEffect="non-scaling-stroke"/>}
        </svg>
        {active && hovered && <><span className="live-chart-guide" style={{ left: `${active.x / W * 100}%` }}/><div className="live-chart-tooltip" style={{ left: `${Math.min(84, Math.max(16, active.x / W * 100))}%` }}><strong>{marketPrice(hovered.price)}</strong><span>{timeLabel(hovered.timestamp, period)}</span></div></>}
      </div>
      <div className="live-chart-dates">{dateTicks.map((point, index) => <span key={index}>{timeLabel(point.timestamp, period)}</span>)}</div>
    </div>
  </div>;
}
