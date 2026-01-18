-- Create indexed_pages table to store crawled web pages
CREATE TABLE public.indexed_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  content TEXT,
  domain TEXT,
  language TEXT DEFAULT 'en',
  page_rank NUMERIC DEFAULT 0,
  last_crawled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create crawl_queue table for URLs to be crawled
CREATE TABLE public.crawl_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  priority INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create search_queries table for analytics
CREATE TABLE public.search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  results_count INTEGER,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better search performance
CREATE INDEX idx_indexed_pages_url ON public.indexed_pages(url);
CREATE INDEX idx_indexed_pages_domain ON public.indexed_pages(domain);
CREATE INDEX idx_indexed_pages_content ON public.indexed_pages USING gin(to_tsvector('english', content));
CREATE INDEX idx_indexed_pages_title ON public.indexed_pages USING gin(to_tsvector('english', title));
CREATE INDEX idx_crawl_queue_status ON public.crawl_queue(status);
CREATE INDEX idx_crawl_queue_priority ON public.crawl_queue(priority DESC);

-- Enable Row Level Security
ALTER TABLE public.indexed_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for indexed_pages (public read access)
CREATE POLICY "Anyone can view indexed pages"
  ON public.indexed_pages
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage indexed pages"
  ON public.indexed_pages
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for crawl_queue (service role only)
CREATE POLICY "Service role can manage crawl queue"
  ON public.crawl_queue
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for search_queries
CREATE POLICY "Users can view their own search queries"
  ON public.search_queries
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anyone can insert search queries"
  ON public.search_queries
  FOR INSERT
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for indexed_pages updated_at
CREATE TRIGGER update_indexed_pages_updated_at
  BEFORE UPDATE ON public.indexed_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to extract domain from URL
CREATE OR REPLACE FUNCTION public.extract_domain(url TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN regexp_replace(
    regexp_replace(url, '^https?://(www\.)?', ''),
    '/.*$',
    ''
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Insert some seed URLs to crawl
INSERT INTO public.crawl_queue (url, priority) VALUES
  ('https://en.wikipedia.org/wiki/Web_browser', 10),
  ('https://en.wikipedia.org/wiki/Search_engine', 10),
  ('https://en.wikipedia.org/wiki/Web_crawler', 9),
  ('https://en.wikipedia.org/wiki/Artificial_intelligence', 9),
  ('https://developer.mozilla.org/en-US/docs/Web/HTML', 8)
ON CONFLICT (url) DO NOTHING;