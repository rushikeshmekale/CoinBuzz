import logo from "@/assets/coinbuzz-logo.png";

export function Logo({ size = 32, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={logo}
        alt="CoinBuzz logo"
        width={size}
        height={size}
        className="rounded-lg"
        style={{ filter: "drop-shadow(0 0 12px oklch(0.85 0.22 145 / 0.6))" }}
      />
      {withText && (
        <span className="font-display text-xl font-bold tracking-tight">
          Coin<span className="text-primary">Buzz</span>
        </span>
      )}
    </div>
  );
}
