import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface SearchRequest {
  q: string;
  limit?: number;
  offset?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/api', '');

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // API Key validation (optional - for rate limiting)
    const apiKey = req.headers.get('x-api-key');
    let rateLimitConfig = { requestsPerMinute: 30 }; // Default public rate limit

    if (apiKey) {
      const { data: keyData } = await supabase
        .from('api_keys')
        .select('*')
        .eq('key', apiKey)
        .eq('is_active', true)
        .single();

      if (keyData) {
        rateLimitConfig.requestsPerMinute = keyData.requests_per_minute;
        
        // Update last used
        await supabase
          .from('api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', keyData.id);
      }
    }

    // Route handling
    if (path === '/search' || path === '' || path === '/') {
      return await handleSearch(req, supabase, rateLimitConfig);
    }

    if (path === '/suggest') {
      return await handleSuggest(req, supabase);
    }

    if (path === '/stats') {
      return await handleStats(supabase);
    }

    return new Response(
      JSON.stringify({
        error: 'Not Found',
        endpoints: {
          'GET/POST /api/search': 'Search the index. Params: q (required), limit, offset',
          'GET /api/suggest': 'Get search suggestions. Params: q (required)',
          'GET /api/stats': 'Get index statistics',
        },
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleSearch(req: Request, supabase: any, rateLimit: { requestsPerMinute: number }) {
  let query: string;
  let limit = 10;
  let offset = 0;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    query = url.searchParams.get('q') || '';
    limit = parseInt(url.searchParams.get('limit') || '10');
    offset = parseInt(url.searchParams.get('offset') || '0');
  } else {
    const body = await req.json();
    query = body.q || body.query || '';
    limit = body.limit || 10;
    offset = body.offset || 0;
  }

  if (!query.trim()) {
    return new Response(
      JSON.stringify({ error: 'Query parameter "q" is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Limit bounds
  limit = Math.min(Math.max(limit, 1), 100);
  offset = Math.max(offset, 0);

  console.log('API Search:', { query, limit, offset });

  // Perform search
  const { data: results, error, count } = await supabase
    .from('indexed_pages')
    .select('id, url, title, description, domain, page_rank, last_crawled_at', { count: 'exact' })
    .or(`title.ilike.%${query}%,description.ilike.%${query}%,content.ilike.%${query}%`)
    .order('page_rank', { ascending: false })
    .order('last_crawled_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({ error: 'Search failed', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Log the query
  await supabase.from('search_queries').insert({ query });

  return new Response(
    JSON.stringify({
      success: true,
      query,
      results: results?.map((r: any) => ({
        url: r.url,
        title: r.title,
        description: r.description,
        domain: r.domain,
        rank: r.page_rank,
        crawled_at: r.last_crawled_at,
      })) || [],
      total: count || 0,
      pagination: {
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': rateLimit.requestsPerMinute.toString(),
      },
    }
  );
}

async function handleSuggest(req: Request, supabase: any) {
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';

  if (!query.trim()) {
    return new Response(
      JSON.stringify({ suggestions: [] }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Get title suggestions from indexed pages
  const { data: pages } = await supabase
    .from('indexed_pages')
    .select('title')
    .ilike('title', `%${query}%`)
    .limit(8);

  const suggestions = pages
    ?.map((p: any) => p.title)
    .filter((t: string) => t && t.length > 0) || [];

  return new Response(
    JSON.stringify({ query, suggestions }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleStats(supabase: any) {
  const [pagesResult, queriesResult, domainsResult] = await Promise.all([
    supabase.from('indexed_pages').select('id', { count: 'exact', head: true }),
    supabase.from('search_queries').select('id', { count: 'exact', head: true }),
    supabase.from('indexed_pages').select('domain').limit(1000),
  ]);

  const uniqueDomains = new Set(domainsResult.data?.map((d: any) => d.domain) || []);

  return new Response(
    JSON.stringify({
      indexed_pages: pagesResult.count || 0,
      total_searches: queriesResult.count || 0,
      unique_domains: uniqueDomains.size,
      api_version: '1.0.0',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
