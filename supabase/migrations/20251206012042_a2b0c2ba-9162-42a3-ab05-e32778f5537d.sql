-- Add display_name and preferences to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS search_private BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS safe_search BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS voice_search_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS autocomplete_enabled BOOLEAN DEFAULT true;

-- Create trending_searches view from search_queries
CREATE OR REPLACE VIEW public.trending_searches AS
SELECT 
  query,
  COUNT(*) as search_count,
  MAX(created_at) as last_searched
FROM public.search_queries
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY query
ORDER BY search_count DESC
LIMIT 20;

-- Grant access to the view
GRANT SELECT ON public.trending_searches TO anon, authenticated;