import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Flame, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TrendingSearch {
  query: string;
  search_count: number;
}

export const TrendingSearches = () => {
  const [trending, setTrending] = useState<TrendingSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        // Using raw query since trending_searches is a view not in generated types
        const { data, error } = await supabase
          .from("search_queries")
          .select("query")
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        // Group and count queries
        const queryCounts = (data || []).reduce((acc: Record<string, number>, item) => {
          acc[item.query] = (acc[item.query] || 0) + 1;
          return acc;
        }, {});

        const sorted = Object.entries(queryCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([query, count]) => ({ query, search_count: count }));

        setTrending(sorted);
      } catch (error) {
        console.error("Error fetching trending:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, []);

  const handleSearch = (query: string) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  if (loading) {
    return (
      <div className="glass-effect rounded-2xl p-6 animate-pulse">
        <div className="h-6 bg-muted/50 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 bg-muted/30 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (trending.length === 0) {
    return null;
  }

  return (
    <div className="glass-effect rounded-2xl p-6 border border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-orange-500" />
        <h3 className="font-display font-semibold">Trending Searches</h3>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {trending.map((item, index) => (
          <button
            key={item.query}
            onClick={() => handleSearch(item.query)}
            className="group flex items-center justify-between px-4 py-2 rounded-lg bg-muted/30 hover:bg-primary/10 hover:border-primary/30 border border-transparent transition-all text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <span className="text-sm truncate">{item.query}</span>
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
