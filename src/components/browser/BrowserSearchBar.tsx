import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Globe, Clock, TrendingUp, ArrowUpRight, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SearchSuggestion {
  type: 'history' | 'trending' | 'suggestion' | 'url';
  text: string;
  url?: string;
  icon?: React.ReactNode;
}

interface BrowserSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onNavigate: (url: string) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  isIncognito?: boolean;
}

export const BrowserSearchBar = ({
  value,
  onChange,
  onNavigate,
  onSearch,
  placeholder = "Search the web or enter URL...",
  className,
  autoFocus = false,
  isIncognito = false,
}: BrowserSearchBarProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions based on input
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || isIncognito) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    const results: SearchSuggestion[] = [];

    try {
      // Check if it looks like a URL
      if (query.includes('.') && !query.includes(' ')) {
        const url = query.startsWith('http') ? query : `https://${query}`;
        results.push({
          type: 'url',
          text: url,
          url,
          icon: <Globe className="w-4 h-4 text-primary" />
        });
      }

      // Fetch from search history
      const { data: historyData } = await supabase
        .from('search_queries')
        .select('query')
        .ilike('query', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(3);

      if (historyData) {
        historyData.forEach(item => {
          if (item.query && !results.find(r => r.text.toLowerCase() === item.query?.toLowerCase())) {
            results.push({
              type: 'history',
              text: item.query,
              icon: <Clock className="w-4 h-4 text-muted-foreground" />
            });
          }
        });
      }

      // Fetch trending searches
      const { data: trendingData } = await supabase
        .from('trending_searches')
        .select('query')
        .ilike('query', `%${query}%`)
        .limit(3);

      if (trendingData) {
        trendingData.forEach(item => {
          if (item.query && !results.find(r => r.text.toLowerCase() === item.query?.toLowerCase())) {
            results.push({
              type: 'trending',
              text: item.query,
              icon: <TrendingUp className="w-4 h-4 text-primary" />
            });
          }
        });
      }

      // Add AI-powered suggestion
      if (query.length > 2) {
        results.push({
          type: 'suggestion',
          text: `Search for "${query}"`,
          icon: <Sparkles className="w-4 h-4 text-secondary" />
        });
      }

    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      setIsLoading(false);
      setSuggestions(results);
    }
  }, [isIncognito]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (isFocused && value) {
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, 200);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, isFocused, fetchSuggestions]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else if (value.trim()) {
        handleSubmit(value);
      }
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  const handleSubmit = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    // Check if it's a URL
    if (trimmed.includes('.') && !trimmed.includes(' ')) {
      const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      onNavigate(url);
    } else {
      onSearch(trimmed);
    }

    setIsFocused(false);
    setSuggestions([]);
  };

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    if (suggestion.type === 'url' && suggestion.url) {
      onNavigate(suggestion.url);
    } else {
      const searchText = suggestion.text.replace(/^Search for "(.+)"$/, '$1');
      onSearch(searchText);
    }
    setIsFocused(false);
    setSuggestions([]);
    onChange(suggestion.text);
  };

  const clearInput = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className={cn(
        "relative flex items-center rounded-full transition-all duration-200",
        isFocused 
          ? isIncognito 
            ? "bg-purple-900/50 ring-2 ring-purple-500/50" 
            : "bg-[#3c3d41] ring-2 ring-primary/50"
          : isIncognito
            ? "bg-purple-900/30"
            : "bg-[#35363a]"
      )}>
        <div className="absolute left-4 flex items-center pointer-events-none">
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Search className={cn(
              "w-4 h-4 transition-colors",
              isFocused ? "text-primary" : "text-gray-400"
            )} />
          )}
        </div>

        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full h-10 pl-11 pr-10 bg-transparent border-none text-sm text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0",
            isIncognito && "text-purple-200"
          )}
          placeholder={placeholder}
          autoFocus={autoFocus}
          data-address-bar="true"
        />

        {value && (
          <button
            onClick={clearInput}
            className="absolute right-4 p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {isFocused && suggestions.length > 0 && (
        <div className={cn(
          "absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl overflow-hidden z-50 border",
          isIncognito 
            ? "bg-purple-950 border-purple-700" 
            : "bg-[#2d2e31] border-gray-700"
        )}>
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${index}`}
              onClick={() => handleSelectSuggestion(suggestion)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                selectedIndex === index
                  ? isIncognito ? "bg-purple-800/50" : "bg-primary/20"
                  : isIncognito ? "hover:bg-purple-800/30" : "hover:bg-white/5"
              )}
            >
              <div className="flex-shrink-0">
                {suggestion.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm truncate",
                  suggestion.type === 'url' ? "text-primary" : "text-gray-200"
                )}>
                  {suggestion.text}
                </p>
                {suggestion.type === 'url' && (
                  <p className="text-xs text-gray-500 truncate">
                    Press Enter to navigate
                  </p>
                )}
              </div>
              <ArrowUpRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
            </button>
          ))}

          {/* Quick Actions */}
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs border-t",
            isIncognito ? "border-purple-700 text-purple-400" : "border-gray-700 text-gray-500"
          )}>
            <span>↑↓ to navigate</span>
            <span>•</span>
            <span>↵ to select</span>
            <span>•</span>
            <span>esc to close</span>
          </div>
        </div>
      )}

      {/* Empty state - show when focused but no input */}
      {isFocused && !value && !isIncognito && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-[#2d2e31] border border-gray-700 shadow-2xl overflow-hidden z-50">
          <div className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              Quick Actions
            </p>
            <div className="space-y-1">
              <QuickAction 
                icon={<Search className="w-4 h-4" />}
                label="Search the web"
                shortcut="Type & Enter"
              />
              <QuickAction 
                icon={<Globe className="w-4 h-4" />}
                label="Go to website"
                shortcut="example.com"
              />
              <QuickAction 
                icon={<TrendingUp className="w-4 h-4" />}
                label="Explore trending"
                shortcut="Popular searches"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const QuickAction = ({ 
  icon, 
  label, 
  shortcut 
}: { 
  icon: React.ReactNode; 
  label: string; 
  shortcut: string; 
}) => (
  <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-default">
    <div className="text-gray-400">{icon}</div>
    <span className="flex-1 text-sm text-gray-300">{label}</span>
    <span className="text-xs text-gray-600">{shortcut}</span>
  </div>
);
