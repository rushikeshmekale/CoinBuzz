import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { fetchTickers, formatPct, formatPrice, streamTickers, type Ticker } from "@/lib/prices";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function PriceTicker({
  symbols,
  onSelect,
}: {
  symbols: string[];
  onSelect?: (s: string) => void;
}) {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});

  useEffect(() => {
    if (symbols.length === 0) return;
    let alive = true;
    fetchTickers(symbols)
      .then((list) => {
        if (!alive) return;
        const map: Record<string, Ticker> = {};
        list.forEach((t) => {
          map[t.symbol] = t;
        });
        setTickers(map);
      })
      .catch(() => {});
    const stop = streamTickers(symbols, (tick) => {
      setTickers((prev) => ({
        ...prev,
        [tick.symbol]: {
          ...(prev[tick.symbol] ?? {
            symbol: tick.symbol,
            price: 0,
            change24h: 0,
            volume24h: 0,
            high24h: 0,
            low24h: 0,
          }),
          price: tick.price,
          change24h: tick.change24h,
        },
      }));
    });
    return () => {
      alive = false;
      stop();
    };
  }, [symbols.join(",")]);

  if (symbols.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
        Add symbols to your watchlist to see live prices.
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {symbols.map((sym) => {
        const t = tickers[sym];
        const up = (t?.change24h ?? 0) >= 0;
        return (
          <button key={sym} onClick={() => onSelect?.(sym)} className="text-left">
            <Card className="p-4 bg-gradient-card hover:shadow-glow hover:border-primary/40 transition-all">
              <div className="flex items-center justify-between">
                <div className="font-mono text-sm font-semibold tracking-wide">
                  {sym.replace("USDT", "/USDT")}
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                    up ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear",
                  )}
                >
                  {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {t ? formatPct(t.change24h) : "—"}
                </span>
              </div>
              <div className="mt-3 font-display text-2xl font-bold tabular-nums">
                {t ? `$${formatPrice(t.price)}` : "—"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                Vol ${t ? formatPrice(t.volume24h) : "—"}
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
