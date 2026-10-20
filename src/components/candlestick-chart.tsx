"use client";

import { useState, type MouseEvent } from "react";
import { Activity } from "lucide-react";
import { type Candle, type ChartPeriod } from "@/lib/market";
import { formatCompactMoney, formatMarketPrice } from "@/lib/currency";

type Props = {
  candles: Candle[];
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

export default function CandlestickChart({ candles, period, status, label, currency = "USD", rate = 1 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const marketPrice = (value: number) => formatMarketPrice(value, currency, rate);
  const compactMoney = (value: number) => formatCompactMoney(value, currency, rate);
  const axisPrice = (value: number) => (value >= 1000 ? formatCompactMoney(value, currency, rate) : marketPrice(value));
  if (status === "loading") {
    return <div className="live-chart-state chart-loading"><div className="chart-skeleton"/><span>Loading candle data…</span></div>;
  }
  if (status === "error" || candles.length < 2) {
    return <div className="live-chart-state"><span className="chart-empty-icon"><Activity size={20}/></span><strong>Chart unavailable</strong><span>Candle data could not be loaded right now.</span></div>;
  }

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const pad = (max - min) * 0.1 || Math.max(max * 0.02, 0.00001);
  const bottom = Math.max(0, min - pad);
  const top = max + pad;
  const W = 760;
  const H = 180;
  const VH = 46;
  const y = (price: number) => H - ((price - bottom) / (top - bottom)) * H;
  const n = candles.length;
  const slot = W / n;
  const bodyWidth = Math.max(1.5, slot * 0.62);
  const maxVolume = Math.max(...candles.map((c) => c.volume), 0.00001);

  const active = hover === null ? null : candles[hover];
  const activeX = hover === null ? null : hover * slot + slot / 2;
  const dateTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => candles[Math.round(fraction * (n - 1))]);
  const ticks = [0, 1, 2, 3].map((index) => top - (index / 3) * (top - bottom));

  const move = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    setHover(Math.min(n - 1, Math.round(fraction * (n - 1))));
  };

  return <div className="candle-chart" role="img" aria-label={`${label} ${period} candlestick chart, latest close ${marketPrice(candles.at(-1)!.close)}`}>
    <div className="candle-chart-values">{ticks.map((tick, index) => <span key={index}>{axisPrice(tick)}</span>)}</div>
    <div className="candle-chart-body">
      <div className="candle-chart-plot" onMouseMove={move} onMouseLeave={() => setHover(null)}>
        <div className="candle-chart-grid">{ticks.map((_, index) => <span key={index}/>)}</div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="candle-chart-svg">
          {candles.map((candle, index) => {
            const up = candle.close >= candle.open;
            const color = up ? "#0fae78" : "#ee5f69";
            const cx = index * slot + slot / 2;
            const openY = y(candle.open);
            const closeY = y(candle.close);
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(1, Math.abs(closeY - openY));
            return <g key={candle.timestamp} opacity={hover === null || hover === index ? 1 : 0.55}>
              <line x1={cx} x2={cx} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke"/>
              <rect x={cx - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color}/>
            </g>;
          })}
        </svg>
        {active && activeX !== null && <span className="candle-chart-guide" style={{ left: `${activeX / W * 100}%` }}/>}
      </div>
      <svg viewBox={`0 0 ${W} ${VH}`} preserveAspectRatio="none" className="candle-volume-svg" style={{ height: VH }}>
        {candles.map((candle, index) => {
          const up = candle.close >= candle.open;
          const color = up ? "#0fae78" : "#ee5f69";
          const cx = index * slot + slot / 2;
          const barHeight = Math.max(0.5, (candle.volume / maxVolume) * (VH - 2));
          return <rect key={candle.timestamp} x={cx - bodyWidth / 2} y={VH - barHeight} width={bodyWidth} height={barHeight} fill={color} opacity={hover === null || hover === index ? 0.55 : 0.28}/>;
        })}
      </svg>
      {active && activeX !== null && <div className="candle-chart-tooltip" style={{ left: `${Math.min(78, Math.max(18, activeX / W * 100))}%` }}>
        <strong>{marketPrice(active.close)}</strong>
        <span>O {marketPrice(active.open)} · H {marketPrice(active.high)} · L {marketPrice(active.low)}</span>
        <span>Vol ≈ {compactMoney(active.volume)}</span>
        <span>{timeLabel(active.timestamp, period)}</span>
      </div>}
      <div className="candle-chart-dates">{dateTicks.map((candle, index) => <span key={index}>{timeLabel(candle.timestamp, period)}</span>)}</div>
    </div>
  </div>;
}
