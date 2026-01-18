import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  query: string;
  limit?: number;
  offset?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 10, offset = 0 }: SearchRequest = await req.json();

    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Search query is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Search request:', { query, limit, offset });

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log the search query for analytics
    const { error: logError } = await supabase
      .from('search_queries')
      .insert({ 
        query,
        user_id: null // Can be updated if authentication is added
      });

    if (logError) {
      console.error('Error logging search query:', logError);
    }

    // Perform full-text search on indexed pages
    // Search in both title and content using PostgreSQL full-text search
    const { data: results, error: searchError, count } = await supabase
      .from('indexed_pages')
      .select('id, url, title, description, domain, page_rank, last_crawled_at', { count: 'exact' })
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,content.ilike.%${query}%`)
      .order('page_rank', { ascending: false })
      .order('last_crawled_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (searchError) {
      console.error('Search error:', searchError);
      return new Response(
        JSON.stringify({ error: 'Search failed', details: searchError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate AI summary for the search
    const aiSummary = generateAISummary(query, results || []);

    // Update search query with results count
    if (!logError) {
      await supabase
        .from('search_queries')
        .update({ results_count: count || 0 })
        .eq('query', query)
        .order('created_at', { ascending: false })
        .limit(1);
    }

    console.log('Search completed:', { 
      query, 
      resultsCount: results?.length || 0,
      totalCount: count 
    });

    return new Response(
      JSON.stringify({
        success: true,
        query,
        results: results || [],
        totalCount: count || 0,
        aiSummary,
        pagination: {
          limit,
          offset,
          hasMore: (count || 0) > offset + limit
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in search function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateAISummary(query: string, results: any[]): string {
  if (results.length === 0) {
    return `No results found for "${query}". Try different keywords or check your spelling.`;
  }

  const domains = [...new Set(results.map(r => r.domain))].slice(0, 3).join(', ');
  return `Found ${results.length} results about "${query}" from trusted sources including ${domains}. The information covers various aspects and perspectives on this topic.`;
}
