// Binance public REST + WebSocket — no API key required.
// Symbols use Binance format: BTCUSDT, ETHUSDT, etc.

export type Ticker = {
  symbol: string;
  price: number;
  change24h: number;       // percentage
  volume24h: number;
  high24h: number;
  low24h: number;
};

const BINANCE_REST = "https://api.binance.com/api/v3";

export async function fetchTickers(symbols: string[]): Promise<Ticker[]> {
  if (symbols.length === 0) return [];
  const url = `${BINANCE_REST}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch tickers");
  const data = await res.json();
  return (Array.isArray(data) ? data : [data]).map((d: any) => ({
    symbol: d.symbol,
    price: parseFloat(d.lastPrice),
    change24h: parseFloat(d.priceChangePercent),
    volume24h: parseFloat(d.quoteVolume),
    high24h: parseFloat(d.highPrice),
    low24h: parseFloat(d.lowPrice),
  }));
}

export async function fetchKlines(symbol: string, interval = "1h", limit = 168) {
  const url = `${BINANCE_REST}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch chart data");
  const data: any[] = await res.json();
  return data.map(k => ({
    time: k[0] as number,
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

export async function searchSymbols(query: string): Promise<string[]> {
  const q = query.toUpperCase().trim();
  if (!q) return [];
  try {
    const res = await fetch(`${BINANCE_REST}/exchangeInfo`);
    const { symbols } = await res.json();
    return symbols
      .filter((s: any) => s.status === "TRADING" && s.quoteAsset === "USDT" && s.symbol.includes(q))
      .slice(0, 20)
      .map((s: any) => s.symbol);
  } catch {
    return [];
  }
}

/** Open a Binance ticker WebSocket. Returns a cleanup fn. */
export function streamTickers(
  symbols: string[],
  onTick: (t: { symbol: string; price: number; change24h: number }) => void
): () => void {
  if (symbols.length === 0) return () => {};
  const streams = symbols.map(s => `${s.toLowerCase()}@miniTicker`).join("/");
  const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
  ws.onmessage = (e) => {
    try {
      const { data } = JSON.parse(e.data);
      onTick({
        symbol: data.s,
        price: parseFloat(data.c),
        change24h: ((parseFloat(data.c) - parseFloat(data.o)) / parseFloat(data.o)) * 100,
      });
    } catch {}
  };
  return () => { try { ws.close(); } catch {} };
}

export function formatPrice(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
