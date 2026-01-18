/// <reference lib="deno.ns" />

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Proxying URL:', url);

    // Fetch the target URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch URL:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: `Failed to fetch: ${response.status} ${response.statusText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = response.headers.get('content-type') || 'text/html';
    let content = await response.text();

    // Only process HTML content
    if (contentType.includes('text/html')) {
      // Get the base URL for resolving relative paths
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

      // Inject base tag to fix relative URLs
      const baseTag = `<base href="${baseUrl}/" target="_self">`;
      
      // Add base tag after <head>
      if (content.includes('<head>')) {
        content = content.replace('<head>', `<head>${baseTag}`);
      } else if (content.includes('<HEAD>')) {
        content = content.replace('<HEAD>', `<HEAD>${baseTag}`);
      } else {
        content = baseTag + content;
      }

      // Remove X-Frame-Options and CSP headers by injecting meta tag override
      const metaOverride = `
        <meta http-equiv="Content-Security-Policy" content="frame-ancestors *;">
        <script>
          // Override window.location to prevent redirects
          (function() {
            // Allow navigation within the frame
            document.addEventListener('click', function(e) {
              const link = e.target.closest('a');
              if (link && link.href) {
                e.preventDefault();
                // Post message to parent to handle navigation
                window.parent.postMessage({ type: 'navigate', url: link.href }, '*');
              }
            });
          })();
        </script>
      `;

      // Insert after base tag or at the beginning
      if (content.includes('<head>')) {
        content = content.replace('<head>', `<head>${metaOverride}`);
      } else if (content.includes('<HEAD>')) {
        content = content.replace('<HEAD>', `<HEAD>${metaOverride}`);
      }

      // Fix relative URLs in common attributes
      const attributes = ['src', 'href', 'action', 'data-src', 'poster'];
      attributes.forEach(attr => {
        // Match attributes with relative paths (not starting with http, //, data:, javascript:, #, mailto:)
        const regex = new RegExp(`(${attr}=["'])(?!https?://|//|data:|javascript:|#|mailto:)(/?)([^"']+)(["'])`, 'gi');
        content = content.replace(regex, (match, prefix, slash, path, suffix) => {
          if (slash === '/') {
            return `${prefix}${baseUrl}/${path}${suffix}`;
          } else {
            return `${prefix}${baseUrl}/${path}${suffix}`;
          }
        });
      });

      // Fix CSS url() references
      content = content.replace(/url\(['"]?(?!https?:\/\/|data:)([^'")]+)['"]?\)/gi, (match, path) => {
        if (path.startsWith('/')) {
          return `url('${baseUrl}${path}')`;
        }
        return `url('${baseUrl}/${path}')`;
      });
    }

    console.log('Successfully proxied URL');

    return new Response(content, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'X-Frame-Options': 'ALLOWALL',
        'Content-Security-Policy': "frame-ancestors *",
      },
    });
  } catch (error: unknown) {
    console.error('Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to proxy request';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
