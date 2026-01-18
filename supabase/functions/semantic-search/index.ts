import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 10, offset = 0, apiKey } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Search query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limiting check if API key is provided
    if (apiKey) {
      const { data: keyData, error: keyError } = await supabase
        .from("api_keys")
        .select("*, user_id")
        .eq("key", apiKey)
        .eq("is_active", true)
        .single();

      if (keyError || !keyData) {
        return new Response(
          JSON.stringify({ error: "Invalid API key" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check rate limit
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      const { count } = await supabase
        .from("api_usage")
        .select("*", { count: "exact", head: true })
        .eq("api_key_id", keyData.id)
        .gte("created_at", oneMinuteAgo);

      if (count && count >= keyData.requests_per_minute) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log usage
      await supabase.from("api_usage").insert({
        api_key_id: keyData.id,
        endpoint: "semantic-search",
      });

      // Update last used
      await supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", keyData.id);
    }

    // Log search query
    const authHeader = req.headers.get("Authorization");
    let userId = null;
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      } catch {
        // Ignore auth errors for public searches
      }
    }

    const { data: searchLog } = await supabase
      .from("search_queries")
      .insert({ query, user_id: userId })
      .select()
      .single();

    console.log("Semantic search for:", query);

    // Perform intelligent text search with multiple matching strategies
    const searchTerms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
    
    // Build OR conditions for flexible matching
    const orConditions = [
      `title.ilike.%${query}%`,
      `description.ilike.%${query}%`,
      `content.ilike.%${query}%`,
    ];

    const { data: results, error: searchError, count } = await supabase
      .from("indexed_pages")
      .select("*", { count: "exact" })
      .or(orConditions.join(","))
      .order("page_rank", { ascending: false })
      .order("last_crawled_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (searchError) {
      console.error("Search error:", searchError);
      throw searchError;
    }

    // Calculate relevance scores based on match quality
    const scoredResults = (results || []).map((page: any) => {
      let score = page.page_rank || 0;
      const titleLower = (page.title || "").toLowerCase();
      const descLower = (page.description || "").toLowerCase();
      const queryLower = query.toLowerCase();

      // Exact phrase match in title (highest priority)
      if (titleLower.includes(queryLower)) score += 100;
      // Exact phrase match in description
      if (descLower.includes(queryLower)) score += 50;
      // Individual term matches
      searchTerms.forEach((term: string) => {
        if (titleLower.includes(term)) score += 10;
        if (descLower.includes(term)) score += 5;
      });

      return {
        url: page.url,
        title: page.title || "Untitled",
        description: page.description || "",
        domain: page.domain,
        relevance_score: score,
      };
    });

    // Sort by calculated relevance score
    scoredResults.sort((a: any, b: any) => b.relevance_score - a.relevance_score);

    // Generate AI summary
    const aiSummary = await generateAISummaryWithAI(query, scoredResults);

    // Update search log with results count
    if (searchLog) {
      await supabase
        .from("search_queries")
        .update({ results_count: count })
        .eq("id", searchLog.id);
    }

    // Save to user's search history
    if (userId) {
      await supabase.from("search_history").insert({
        user_id: userId,
        query,
        results_count: count || 0,
      });
    }

    return new Response(
      JSON.stringify({
        results: scoredResults,
        total: count || 0,
        query,
        offset,
        limit,
        ai_summary: aiSummary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in semantic-search:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateAISummary(query: string, results: any[]): string {
  if (results.length === 0) {
    return `No results found for "${query}". Try different keywords or check your spelling.`;
  }

  const domains = [...new Set(results.map((r) => r.domain))].slice(0, 3);
  return `Found ${results.length} results for "${query}" across ${domains.join(", ")} and more. Results ranked by relevance.`;
}

async function generateAISummaryWithAI(query: string, results: any[]): Promise<string> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY || results.length === 0) {
      return generateAISummary(query, results);
    }

    const context = results.slice(0, 5).map((r, i) => 
      `${i + 1}. ${r.title}\n   ${r.description || "No description"}`
    ).join("\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a helpful search assistant. Provide a brief, informative summary of the search results in 2-3 sentences.",
          },
          {
            role: "user",
            content: `User searched for: "${query}"\n\nTop results:\n${context}\n\nProvide a concise summary of what these results offer.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return generateAISummary(query, results);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error generating AI summary:", error);
    return generateAISummary(query, results);
  }
}
