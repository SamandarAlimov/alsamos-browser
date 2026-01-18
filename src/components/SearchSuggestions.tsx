import { useState, useEffect, useRef } from "react";
import { Search, TrendingUp, Clock, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SearchSuggestionsProps {
  query: string;
  isOpen: boolean;
  onSelect: (suggestion: string) => void;
  onClose: () => void;
}

interface Suggestion {
  text: string;
  type: "trending" | "recent" | "autocomplete";
}

export const SearchSuggestions = ({
  query,
  isOpen,
  onSelect,
  onClose,
}: SearchSuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Popular/trending searches (could be fetched from DB)
  const trendingSuggestions = [
    "artificial intelligence",
    "machine learning",
    "web development",
    "climate change",
    "cryptocurrency",
  ];

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query.trim()) {
        // Show trending when no query
        setSuggestions(
          trendingSuggestions.slice(0, 5).map((text) => ({
            text,
            type: "trending" as const,
          }))
        );
        return;
      }

      // Filter trending suggestions that match query
      const matchingTrending = trendingSuggestions
        .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 3)
        .map((text) => ({ text, type: "trending" as const }));

      // Fetch autocomplete from indexed pages
      try {
        const { data } = await supabase
          .from("indexed_pages")
          .select("title")
          .ilike("title", `%${query}%`)
          .limit(5);

        const pageSuggestions =
          data?.map((p) => ({
            text: p.title || "",
            type: "autocomplete" as const,
          })) || [];

        setSuggestions([...matchingTrending, ...pageSuggestions].slice(0, 8));
      } catch {
        setSuggestions(matchingTrending);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 150);
    return () => clearTimeout(debounce);
  }, [query]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          e.preventDefault();
          onSelect(suggestions[selectedIndex].text);
        }
        break;
      case "Escape":
        onClose();
        break;
    }
  };

  if (!isOpen || suggestions.length === 0) return null;

  const getIcon = (type: Suggestion["type"]) => {
    switch (type) {
      case "trending":
        return <TrendingUp className="w-4 h-4 text-primary" />;
      case "recent":
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Search className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="absolute top-full left-0 right-0 mt-2 glass-effect rounded-2xl shadow-premium overflow-hidden z-50 border border-border/50"
    >
      <div className="py-2">
        {!query && (
          <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Trending Searches
          </div>
        )}
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.text}-${index}`}
            onClick={() => onSelect(suggestion.text)}
            className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left ${
              selectedIndex === index ? "bg-muted/50" : ""
            }`}
          >
            {getIcon(suggestion.type)}
            <span className="flex-1 text-foreground truncate">
              {suggestion.text}
            </span>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </div>
  );
};
