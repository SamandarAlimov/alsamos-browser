import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CrawlRequest {
  url?: string;
  maxUrls?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, maxUrls = 5 }: CrawlRequest = await req.json();

    console.log('Crawl request:', { url, maxUrls });

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let urlsToCrawl: string[] = [];

    if (url) {
      // Crawl specific URL
      urlsToCrawl = [url];
    } else {
      // Get URLs from queue
      const { data: queuedUrls, error: queueError } = await supabase
        .from('crawl_queue')
        .select('id, url')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(maxUrls);

      if (queueError) {
        console.error('Error fetching queue:', queueError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch crawl queue' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      urlsToCrawl = queuedUrls?.map(item => item.url) || [];
    }

    if (urlsToCrawl.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No URLs to crawl',
          crawled: 0 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Starting crawl for URLs:', urlsToCrawl);

    const results = [];

    for (const targetUrl of urlsToCrawl) {
      try {
        // Mark as processing
        await supabase
          .from('crawl_queue')
          .update({ 
            status: 'processing',
            processed_at: new Date().toISOString()
          })
          .eq('url', targetUrl);

        // Fetch the page
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'AlsamosBot/1.0 (+https://browser.alsamos.com)',
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const document = new DOMParser().parseFromString(html, 'text/html');

        if (!document) {
          throw new Error('Failed to parse HTML');
        }

        // Extract metadata
        const title = document.querySelector('title')?.textContent?.trim() || 
                     document.querySelector('h1')?.textContent?.trim() ||
                     'Untitled Page';

        const description = 
          document.querySelector('meta[name="description"]')?.getAttribute('content') ||
          document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
          '';

        // Extract text content (remove scripts, styles, etc.)
        const scripts = document.querySelectorAll('script, style, nav, footer, header');
        scripts.forEach((el: any) => el.remove && el.remove());

        const content = document.querySelector('body')?.textContent
          ?.replace(/\s+/g, ' ')
          .trim()
          .substring(0, 10000) || ''; // Limit to 10k chars

        const domain = new URL(targetUrl).hostname.replace('www.', '');

        // Detect language (simple heuristic)
        const language = document.querySelector('html')?.getAttribute('lang')?.substring(0, 2) || 'en';

        // Calculate basic page rank (can be enhanced with more sophisticated algorithms)
        const pageRank = calculatePageRank(content, title, domain);

        // Store in indexed_pages
        const { data: upsertedPage, error: upsertError } = await supabase
          .from('indexed_pages')
          .upsert({
            url: targetUrl,
            title,
            description,
            content,
            domain,
            language,
            page_rank: pageRank,
            last_crawled_at: new Date().toISOString(),
          }, {
            onConflict: 'url'
          })
          .select()
          .single();

        if (upsertError) {
          throw upsertError;
        }

        // Generate embeddings for the page asynchronously
        if (upsertedPage && upsertedPage.id) {
          const embeddingText = `${title || ''} ${description || ''} ${content?.substring(0, 1000) || ''}`;
          
          // Call generate-embeddings function in background
          fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-embeddings`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                pageId: upsertedPage.id,
                text: embeddingText,
              }),
            }
          ).then(res => {
            if (res.ok) {
              console.log('Embedding generated for', targetUrl);
            } else {
              console.error('Failed to generate embedding for', targetUrl);
            }
          }).catch(err => {
            console.error('Error generating embedding:', err);
          });
        }

        // Mark as completed in queue
        await supabase
          .from('crawl_queue')
          .update({ 
            status: 'completed',
            processed_at: new Date().toISOString()
          })
          .eq('url', targetUrl);

        console.log('Successfully crawled:', targetUrl);
        results.push({ url: targetUrl, success: true });

        // Extract and queue new URLs (basic crawler)
        const links = document.querySelectorAll('a[href]');
        const newUrls: string[] = [];

        for (const link of links) {
          try {
            const href = (link as any).getAttribute('href');
            if (!href) continue;

            const absoluteUrl = new URL(href, targetUrl).toString();
            
            // Only queue URLs from the same domain (polite crawling)
            if (new URL(absoluteUrl).hostname === new URL(targetUrl).hostname) {
              newUrls.push(absoluteUrl);
            }
          } catch {
            // Invalid URL, skip
          }
        }

        // Add new URLs to queue (limit to avoid explosion)
        if (newUrls.length > 0) {
          const uniqueUrls = [...new Set(newUrls)].slice(0, 10);
          
          for (const newUrl of uniqueUrls) {
            // Check if URL already exists before inserting
            const { data: existingUrl } = await supabase
              .from('crawl_queue')
              .select('id')
              .eq('url', newUrl)
              .maybeSingle();
            
            if (!existingUrl) {
              await supabase
                .from('crawl_queue')
                .insert({ 
                  url: newUrl, 
                  priority: 3 
                });
            }
          }
        }

      } catch (error: any) {
        console.error('Error crawling URL:', targetUrl, error);
        
        // Mark as failed
        await supabase
          .from('crawl_queue')
          .update({ 
            status: 'failed',
            error_message: error.message,
            retry_count: supabase.rpc('increment_retry_count'),
            processed_at: new Date().toISOString()
          })
          .eq('url', targetUrl);

        results.push({ 
          url: targetUrl, 
          success: false, 
          error: error.message 
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Crawled ${urlsToCrawl.length} URLs`,
        crawled: urlsToCrawl.length,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in crawl function:', error);
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

function calculatePageRank(content: string, title: string, domain: string): number {
  let rank = 0;

  // Content length (longer = more valuable, to a point)
  rank += Math.min(content.length / 1000, 5);

  // Title presence and length
  if (title && title.length > 10) rank += 2;

  // Domain reputation (simple heuristic)
  const reputableDomains = ['wikipedia.org', 'mozilla.org', 'github.com', 'stackoverflow.com'];
  if (reputableDomains.some(d => domain.includes(d))) {
    rank += 10;
  }

  // HTTPS bonus
  rank += 1;

  return Math.round(rank * 10) / 10;
}
