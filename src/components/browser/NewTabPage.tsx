import { useState, useEffect } from "react";
import { 
  Clock, 
  Globe,
  Star,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrowserSearchBar } from "./BrowserSearchBar";
import alsamosLogo from "@/assets/alsamos-logo.png";

interface QuickAccessSite {
  id: string;
  title: string;
  url: string;
  favicon: string;
  visits?: number;
}

interface NewTabPageProps {
  onNavigate: (url: string) => void;
}

const defaultQuickAccess: QuickAccessSite[] = [
  { id: "1", title: "Google", url: "https://www.google.com", favicon: "https://www.google.com/s2/favicons?domain=google.com&sz=64" },
  { id: "2", title: "YouTube", url: "https://www.youtube.com", favicon: "https://www.google.com/s2/favicons?domain=youtube.com&sz=64" },
  { id: "3", title: "GitHub", url: "https://www.github.com", favicon: "https://www.google.com/s2/favicons?domain=github.com&sz=64" },
  { id: "4", title: "Twitter", url: "https://www.twitter.com", favicon: "https://www.google.com/s2/favicons?domain=twitter.com&sz=64" },
  { id: "5", title: "Reddit", url: "https://www.reddit.com", favicon: "https://www.google.com/s2/favicons?domain=reddit.com&sz=64" },
  { id: "6", title: "Wikipedia", url: "https://www.wikipedia.org", favicon: "https://www.google.com/s2/favicons?domain=wikipedia.org&sz=64" },
  { id: "7", title: "LinkedIn", url: "https://www.linkedin.com", favicon: "https://www.google.com/s2/favicons?domain=linkedin.com&sz=64" },
  { id: "8", title: "Amazon", url: "https://www.amazon.com", favicon: "https://www.google.com/s2/favicons?domain=amazon.com&sz=64" },
];

export const NewTabPage = ({ onNavigate }: NewTabPageProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSites, setRecentSites] = useState<QuickAccessSite[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);

  useEffect(() => {
    loadRecentSites();
    loadTrendingSearches();
  }, []);

  const loadRecentSites = async () => {
    try {
      const { data: bookmarks } = await supabase
        .from('bookmarked_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(4);

      if (bookmarks && bookmarks.length > 0) {
        const sites: QuickAccessSite[] = bookmarks.map((b, i) => ({
          id: `recent-${i}`,
          title: b.title || b.domain || "Website",
          url: b.url,
          favicon: b.favicon_url || `https://www.google.com/s2/favicons?domain=${b.domain}&sz=64`
        }));
        setRecentSites(sites);
      }
    } catch (err) {
      console.error('Error loading recent sites:', err);
    }
  };

  const loadTrendingSearches = async () => {
    try {
      const { data } = await supabase
        .from('trending_searches')
        .select('query')
        .limit(8);

      if (data) {
        setTrendingSearches(data.map(d => d.query || "").filter(Boolean));
      }
    } catch (err) {
      console.error('Error loading trending searches:', err);
    }
  };

  const handleSearch = (query: string) => {
    // Navigate to Alsamos Search page
    window.location.href = `/search?q=${encodeURIComponent(query)}`;
  };

  const handleNavigate = (url: string) => {
    onNavigate(url);
  };

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-full bg-gradient-to-b from-[#1a1a1d] to-[#202124] text-white flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center px-4 pt-16">
        {/* Logo & Greeting */}
        <div className="mb-10 text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <img 
              src={alsamosLogo} 
              alt="Alsamos" 
              className="relative w-20 h-20 mx-auto object-contain drop-shadow-2xl" 
            />
          </div>
          <h1 className="text-4xl font-display font-light text-gray-100 mb-2 tracking-tight">
            {greeting}
          </h1>
          <p className="text-gray-500 text-sm flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Powered by Alsamos AI Search
          </p>
        </div>

        {/* Enhanced Search Bar */}
        <div className="w-full max-w-2xl mb-12">
          <BrowserSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onNavigate={handleNavigate}
            onSearch={handleSearch}
            placeholder="Search with Alsamos or enter URL..."
            autoFocus
          />
          
          {/* Search Powered By */}
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-primary" />
              AI-Powered
            </span>
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Web Search
            </span>
          </div>
        </div>

        {/* Quick Access Grid */}
        <div className="w-full max-w-4xl mb-10">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2 px-2">
            <Star className="w-3.5 h-3.5 text-primary" />
            Quick Access
          </h3>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {defaultQuickAccess.map((site) => (
              <button
                key={site.id}
                onClick={() => handleNavigate(site.url)}
                className="group flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-white/5 transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#35363a] to-[#2a2a2d] flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/10 transition-all duration-200 border border-white/5">
                  <img 
                    src={site.favicon} 
                    alt={site.title}
                    className="w-6 h-6"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors truncate w-full text-center font-medium">
                  {site.title}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Sites */}
        {recentSites.length > 0 && (
          <div className="w-full max-w-4xl mb-10">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2 px-2">
              <Clock className="w-3.5 h-3.5 text-secondary" />
              Recently Visited
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recentSites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => handleNavigate(site.url)}
                  className="group flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-[#2d2e31] to-[#252527] hover:from-[#35363a] hover:to-[#2d2e31] transition-all duration-200 text-left border border-white/5 hover:border-primary/20"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#35363a] group-hover:bg-[#3c3d41] flex items-center justify-center flex-shrink-0 transition-colors">
                    <img 
                      src={site.favicon} 
                      alt=""
                      className="w-5 h-5"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 truncate font-medium">{site.title}</p>
                    <p className="text-xs text-gray-600 truncate">{new URL(site.url).hostname}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-primary group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trending Searches */}
        {trendingSearches.length > 0 && (
          <div className="w-full max-w-4xl">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2 px-2">
              <TrendingUp className="w-3.5 h-3.5 text-accent" />
              Trending Now
            </h3>
            <div className="flex flex-wrap gap-2">
              {trendingSearches.map((query, i) => (
                <button
                  key={i}
                  onClick={() => handleSearch(query)}
                  className="group px-4 py-2.5 rounded-full bg-gradient-to-r from-[#2d2e31] to-[#252527] hover:from-primary/20 hover:to-secondary/20 text-sm text-gray-400 hover:text-white transition-all duration-200 border border-white/5 hover:border-primary/30 flex items-center gap-2"
                >
                  <TrendingUp className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <img src={alsamosLogo} alt="Alsamos" className="w-5 h-5 object-contain" />
          <span className="text-sm font-display text-gray-400">Alsamos Browser</span>
        </div>
        <p className="text-xs text-gray-600">
          Fast • Secure • AI-Powered
        </p>
      </div>
    </div>
  );
};
