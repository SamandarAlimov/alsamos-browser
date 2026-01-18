-- Drop the view and recreate with proper INVOKER security
DROP VIEW IF EXISTS public.trending_searches;

CREATE VIEW public.trending_searches 
WITH (security_invoker = on)
AS
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