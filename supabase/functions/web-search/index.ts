import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  sitelinks?: { title: string; link: string }[];
}

interface SerperResponse {
  organic: SerperResult[];
  answerBox?: {
    title: string;
    answer: string;
    snippet: string;
    link: string;
  };
  knowledgeGraph?: {
    title: string;
    type: string;
    description: string;
    imageUrl?: string;
    attributes?: Record<string, string>;
  };
  relatedSearches?: { query: string }[];
  shopping?: any[];
}

// Time range mapping for Serper
const timeRangeMap: Record<string, string> = {
  hour: "qdr:h",
  day: "qdr:d",
  week: "qdr:w",
  month: "qdr:m",
  year: "qdr:y",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      query, 
      limit = 10, 
      offset = 0, 
      type = "search",
      filters = {}
    } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Search query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    if (!SERPER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Search API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Web search for:", query, "type:", type, "filters:", filters);

    // Build Serper request body with filters
    const serperBody: Record<string, any> = {
      q: query,
      num: Math.min(limit + offset, 100),
      gl: filters.region || "us",
      hl: "en",
    };

    // Add time range filter
    if (filters.timeRange && filters.timeRange !== "any" && timeRangeMap[filters.timeRange]) {
      serperBody.tbs = timeRangeMap[filters.timeRange];
    }

    // Determine endpoint based on search type
    let serperEndpoint: string;
    switch (type) {
      case "images":
        serperEndpoint = "https://google.serper.dev/images";
        break;
      case "news":
        serperEndpoint = "https://google.serper.dev/news";
        break;
      case "videos":
        serperEndpoint = "https://google.serper.dev/videos";
        break;
      case "shopping":
        serperEndpoint = "https://google.serper.dev/shopping";
        break;
      case "scholar":
      case "academic":
        serperEndpoint = "https://google.serper.dev/scholar";
        break;
      default:
        serperEndpoint = "https://google.serper.dev/search";
    }

    const startTime = Date.now();
    
    const serperResponse = await fetch(serperEndpoint, {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serperBody),
    });

    const apiTime = Date.now() - startTime;
    console.log(`Serper API response time: ${apiTime}ms`);

    if (!serperResponse.ok) {
      console.error("Serper API error:", serperResponse.status);
      throw new Error("Search service temporarily unavailable");
    }

    const serperData = await serperResponse.json();
    
    // Handle different response types
    let results: any[] = [];
    
    if (type === "images") {
      console.log("Serper image results count:", serperData.images?.length || 0);
      results = (serperData.images || []).slice(offset, offset + limit).map((item: any, index: number) => ({
        url: item.link,
        title: item.title,
        description: item.source || "",
        domain: extractDomain(item.link),
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl,
        relevance_score: 100 - index,
        source: "web",
      }));
    } else if (type === "news") {
      console.log("Serper news results count:", serperData.news?.length || 0);
      results = (serperData.news || []).slice(offset, offset + limit).map((item: any, index: number) => ({
        url: item.link,
        title: item.title,
        description: item.snippet || "",
        domain: extractDomain(item.link),
        imageUrl: item.imageUrl,
        date: item.date,
        relevance_score: 100 - index,
        source: "web",
      }));
    } else if (type === "videos") {
      console.log("Serper video results count:", serperData.videos?.length || 0);
      results = (serperData.videos || []).slice(offset, offset + limit).map((item: any, index: number) => ({
        url: item.link,
        title: item.title,
        description: item.snippet || "",
        domain: extractDomain(item.link),
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl,
        duration: item.duration,
        channel: item.channel,
        date: item.date,
        relevance_score: 100 - index,
        source: "web",
      }));
    } else if (type === "shopping") {
      console.log("Serper shopping results count:", serperData.shopping?.length || 0);
      results = (serperData.shopping || []).slice(offset, offset + limit).map((item: any, index: number) => ({
        url: item.link,
        title: item.title,
        description: item.source || "",
        domain: extractDomain(item.link),
        imageUrl: item.imageUrl,
        price: item.price,
        rating: item.rating,
        ratingCount: item.ratingCount,
        merchant: item.source,
        delivery: item.delivery,
        relevance_score: 100 - index,
        source: "shopping",
      }));
    } else if (type === "scholar" || type === "academic") {
      console.log("Serper scholar results count:", serperData.organic?.length || 0);
      results = (serperData.organic || []).slice(offset, offset + limit).map((item: any, index: number) => ({
        url: item.link,
        title: item.title,
        description: item.snippet || "",
        domain: extractDomain(item.link),
        authors: item.publication_info?.authors || [],
        year: item.publication_info?.year,
        citedBy: item.inline_links?.cited_by?.total || 0,
        publication: item.publication_info?.summary || "",
        relevance_score: 100 - index,
        source: "academic",
      }));
    } else {
      console.log("Serper results count:", serperData.organic?.length || 0);
      results = (serperData.organic || []).slice(offset, offset + limit).map((item: any, index: number) => ({
        url: item.link,
        title: item.title,
        description: item.snippet || "",
        domain: extractDomain(item.link),
        relevance_score: 100 - index,
        position: item.position,
        source: "web",
        sitelinks: item.sitelinks,
      }));
    }

    // Initialize Supabase for logging and AI summary
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log the search query (non-blocking)
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

    // Non-blocking log - fire and forget
    supabase.from("search_queries").insert({ 
      query, 
      user_id: userId,
      results_count: results.length 
    });

    // Generate AI summary using Lovable AI (only for web search)
    let aiSummary = "";
    if (type === "search" && results.length > 0) {
      aiSummary = await generateAISummary(query, results, serperData);
    }

    const totalCount = type === "images" 
      ? serperData.images?.length 
      : type === "news" 
      ? serperData.news?.length 
      : type === "videos"
      ? serperData.videos?.length
      : type === "shopping"
      ? serperData.shopping?.length
      : serperData.organic?.length;

    const totalTime = Date.now() - startTime;
    console.log(`Total search time: ${totalTime}ms`);

    return new Response(
      JSON.stringify({
        results,
        total: totalCount || 0,
        query,
        offset,
        limit,
        ai_summary: aiSummary,
        answer_box: type === "search" ? serperData.answerBox : null,
        knowledge_graph: type === "search" ? serperData.knowledgeGraph : null,
        related_searches: type === "search" ? (serperData.relatedSearches?.map((r: any) => r.query) || []) : [],
        source: "serper",
        type,
        searchTime: totalTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in web-search:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Search failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function generateAISummary(query: string, results: any[], serperData: SerperResponse): Promise<string> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY || results.length === 0) {
      return generateBasicSummary(query, results);
    }

    // Build context from answer box and top results
    let context = "";
    
    if (serperData.answerBox) {
      context += `Direct Answer: ${serperData.answerBox.answer || serperData.answerBox.snippet}\n\n`;
    }
    
    if (serperData.knowledgeGraph) {
      context += `Knowledge: ${serperData.knowledgeGraph.title} - ${serperData.knowledgeGraph.description}\n\n`;
    }

    context += "Top Results:\n" + results.slice(0, 5).map((r, i) => 
      `${i + 1}. ${r.title}\n   ${r.description}`
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
            content: "You are a helpful search assistant. Provide a concise, accurate 2-3 sentence summary answering the user's query based on the search results. Be direct, informative, and cite specific facts when available. Format key points with **bold** for emphasis.",
          },
          {
            role: "user",
            content: `Query: "${query}"\n\n${context}\n\nProvide a brief, helpful answer with key facts highlighted.`,
          },
        ],
        max_tokens: 250,
      }),
    });

    if (!response.ok) {
      return generateBasicSummary(query, results);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || generateBasicSummary(query, results);
  } catch (error) {
    console.error("Error generating AI summary:", error);
    return generateBasicSummary(query, results);
  }
}

function generateBasicSummary(query: string, results: any[]): string {
  if (results.length === 0) {
    return `No results found for "${query}". Try different keywords or check your spelling.`;
  }

  const domains = [...new Set(results.slice(0, 5).map(r => r.domain))].join(", ");
  return `Found ${results.length} results for "${query}" from ${domains} and more.`;
}
