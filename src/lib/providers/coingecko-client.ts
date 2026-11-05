import { numeric } from "./types";

const proKey = process.env.COINGECKO_PRO_API_KEY;
const demoKey = process.env.COINGECKO_API_KEY || process.env.COINGECKO_DEMO_API_KEY;
export const coingeckoBase = proKey ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3";
export const coingeckoAccess = proKey ? "pro" : demoKey ? "demo" : "keyless";

// Demo is documented around 100 calls/min; stay below that. Keyless public
// access is much lower and is only suitable for light local evaluation.
const minIntervalMs = proKey ? 120 : demoKey ? 750 : 13_000;
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

async function throttle() {
  const wait = Math.max(0, lastCall + minIntervalMs - Date.now());
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  lastCall = Date.now();
}

export async function coingeckoRequest<T>(path: string, revalidate = 60): Promise<T> {
  const run = async (): Promise<T> => {
    await throttle();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (proKey) headers["x-cg-pro-api-key"] = proKey;
    else if (demoKey) headers["x-cg-demo-api-key"] = demoKey;
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`${coingeckoBase}${path}`, { headers, ...(revalidate > 0 ? { next: { revalidate } } : { cache: "no-store" as const }), signal: AbortSignal.timeout(15_000) });
      if (response.status === 429 && attempt === 0) {
        const retry = numeric(response.headers.get("retry-after"));
        await new Promise(resolve => setTimeout(resolve, Math.min(15_000, Math.max(2_000, (retry ?? 2) * 1000))));
        continue;
      }
      // Never log the URL or headers: they may contain credentials.
      if (!response.ok) throw new Error(`CoinGecko returned HTTP ${response.status}`);
      return response.json() as Promise<T>;
    }
    throw new Error("CoinGecko rate limit reached");
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}
