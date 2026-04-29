import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/news")({
  component: NewsPage,
});

type Article = {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
};

const CATEGORIES = [
  { id: "crypto", label: "Crypto", q: "bitcoin OR ethereum OR crypto OR blockchain" },
  { id: "defi",   label: "DeFi",   q: "DeFi OR decentralized finance OR NFT OR web3" },
  { id: "macro",  label: "Macro",  q: "Federal Reserve OR inflation OR interest rates OR economy" },
] as const;

type Category = typeof CATEGORIES[number]["id"];

async function fetchNews(q: string): Promise<Article[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const url = `${supabaseUrl}/functions/v1/news-proxy?q=${encodeURIComponent(q)}&pageSize=20`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  const json = await res.json();
  if (json.status === "error" || json.error) throw new Error(json.message ?? json.error ?? "Failed");
  return (json.articles ?? []).filter((a: Article) => a.title && a.title !== "[Removed]");
}

function NewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("crypto");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load(cat: Category) {
    setLoading(true);
    setError(null);
    const q = CATEGORIES.find(c => c.id === cat)?.q ?? "crypto";
    try {
      const data = await fetchNews(q);
      setArticles(data);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message ?? "Failed to fetch news");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(category); }, [category]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold lg:text-4xl">Market news</h1>
          <p className="text-muted-foreground mt-1">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Headlines to stay ahead of the moves."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(category)} disabled={loading}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex gap-2">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors",
              category === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="flex gap-4 bg-card border rounded-xl p-4 hover:border-primary/50 transition-colors group"
            >
              {a.urlToImage && (
                <img
                  src={a.urlToImage}
                  alt=""
                  className="w-20 h-16 object-cover rounded-lg flex-shrink-0 bg-muted"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{a.source.name}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.publishedAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </span>
                </div>
                <h3 className="font-semibold leading-snug text-sm line-clamp-2 group-hover:text-primary transition-colors">
                  {a.title}
                </h3>
                {a.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                )}
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
          {articles.length === 0 && !error && (
            <div className="flex flex-col items-center py-16 text-center gap-3">
              <Newspaper className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">No articles found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}