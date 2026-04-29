// News proxy Edge Function — bypasses NewsAPI's browser restriction
// Deploy: supabase functions deploy news-proxy --no-verify-jwt
// Secret needed: NEWS_API_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "crypto bitcoin";
    const pageSize = url.searchParams.get("pageSize") ?? "20";

    if (!NEWS_API_KEY) {
      return new Response(JSON.stringify({ error: "NEWS_API_KEY not set" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const apiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=${pageSize}&language=en&apiKey=${NEWS_API_KEY}`;

    const res = await fetch(apiUrl);
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
