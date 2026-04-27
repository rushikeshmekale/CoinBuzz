import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchKlines, formatPrice } from "@/lib/prices";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const INTERVALS = [
  { label: "1H", value: "1m", limit: 60 },
  { label: "1D", value: "15m", limit: 96 },
  { label: "1W", value: "1h", limit: 168 },
  { label: "1M", value: "4h", limit: 180 },
] as const;

export function PriceChart({ symbol }: { symbol: string }) {
  const [interval, setInterval] = useState<typeof INTERVALS[number]>(INTERVALS[2]);
  const [data, setData] = useState<{ t: number; price: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchKlines(symbol, interval.value, interval.limit)
      .then(k => alive && setData(k.map(x => ({ t: x.time, price: x.close }))))
      .catch(() => alive && setData([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [symbol, interval]);

  const first = data[0]?.price ?? 0;
  const last = data[data.length - 1]?.price ?? 0;
  const up = last >= first;
  const color = up ? "var(--color-bull)" : "var(--color-bear)";

  return (
    <Card className="p-4 lg:p-6 bg-gradient-card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-sm text-muted-foreground">{symbol.replace("USDT", "/USDT")}</div>
          <div className="font-display text-3xl font-bold tabular-nums">
            ${formatPrice(last)}
          </div>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {INTERVALS.map(iv => (
            <Button
              key={iv.label}
              variant={interval === iv ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setInterval(iv)}
            >
              {iv.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="h-[280px] lg:h-[360px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading chart…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="cb-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })} stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis dataKey="price" domain={["auto", "auto"]} stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => `$${formatPrice(v)}`} width={70} />
              <Tooltip
                contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                labelFormatter={(v) => new Date(v as number).toLocaleString()}
                formatter={(v: number) => [`$${formatPrice(v)}`, "Price"]}
              />
              <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2} fill="url(#cb-area)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
