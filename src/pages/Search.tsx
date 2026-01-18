import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Globe,
  Search as SearchIcon,
  Brain,
  Sparkles,
  Loader2,
  User,
  LogOut,
  Bookmark,
  Star,
  History,
  Settings,
  Zap,
  Image,
  Newspaper,
  ExternalLink,
  Video,
  Play,
  Clock,
  ShoppingBag,
  GraduationCap,
  Timer,
  ChevronRight,
} from "lucide-react";
import { SearchSuggestions } from "@/components/SearchSuggestions";
import { VoiceSearch } from "@/components/VoiceSearch";
import { SafeBrowsingWarning } from "@/components/SafeBrowsingWarning";
import { useSafeBrowsing, SafetyCheckResult } from "@/hooks/useSafeBrowsing";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UrlSubmit } from "@/components/UrlSubmit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIAssistant, AIAssistantTrigger } from "@/components/AIAssistant";
import { SearchResultSkeleton } from "@/components/search/SearchResultSkeleton";
import { SearchFilters, SearchFiltersState } from "@/components/search/SearchFilters";
import { HighlightedText } from "@/components/search/HighlightedText";
import { useSearchCache } from "@/hooks/useSearchCache";
import alsamosLogo from "@/assets/alsamos-logo.png";

interface SearchResult {
  url: string;
  title: string;
  description: string;
  domain: string;
  relevance_score?: number;
  source?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  date?: string;
  duration?: string;
  channel?: string;
  price?: string;
  rating?: number;
  ratingCount?: number;
  merchant?: string;
  authors?: string[];
  year?: string;
  citedBy?: number;
  publication?: string;
  sitelinks?: { title: string; link: string }[];
}

interface AnswerBox {
  title: string;
  answer: string;
  snippet: string;
  link: string;
}

interface KnowledgeGraph {
  title: string;
  type: string;
  description: string;
  imageUrl?: string;
}

type SearchType = "search" | "images" | "news" | "videos" | "shopping" | "academic";

interface CachedSearchResult {
  results: SearchResult[];
  aiSummary: string;
  answerBox: AnswerBox | null;
  knowledgeGraph: KnowledgeGraph | null;
  relatedSearches: string[];
  totalCount: number;
  searchTime: number;
}

const Search = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { checkUrl } = useSafeBrowsing();
  const { get: getCached, set: setCached } = useSearchCache<CachedSearchResult>();
  
  const [user, setUser] = useState<any>(null);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [answerBox, setAnswerBox] = useState<AnswerBox | null>(null);
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraph | null>(null);
  const [relatedSearches, setRelatedSearches] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  const [bookmarkedUrls, setBookmarkedUrls] = useState<Set<string>>(new Set());
  const [savedSearches, setSavedSearches] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchType, setSearchType] = useState<SearchType>((searchParams.get("type") as SearchType) || "search");
  const [warningOpen, setWarningOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string>("");
  const [pendingSafetyResult, setPendingSafetyResult] = useState<SafetyCheckResult | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFiltersState>({
    timeRange: "any",
    region: "us",
    safeSearch: true,
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle URL params on mount
  useEffect(() => {
    const q = searchParams.get("q");
    const type = searchParams.get("type") as SearchType;
    
    if (q) {
      setQuery(q);
      if (type) setSearchType(type);
      // Auto-search if URL has query
      setTimeout(() => {
        handleSearch(undefined, type || "search", q);
      }, 0);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    const [bookmarksResult, savedResult] = await Promise.all([
      supabase.from("bookmarked_results").select("url").eq("user_id", userId),
      supabase.from("saved_searches").select("query").eq("user_id", userId),
    ]);

    if (bookmarksResult.data) {
      setBookmarkedUrls(new Set(bookmarksResult.data.map(b => b.url)));
    }

    if (savedResult.data) {
      setSavedSearches(savedResult.data.map(s => s.query));
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const handleBookmark = async (result: SearchResult) => {
    if (!user) {
      toast.error("Please sign in to bookmark results");
      navigate("/auth");
      return;
    }

    try {
      if (bookmarkedUrls.has(result.url)) {
        await supabase
          .from("bookmarked_results")
          .delete()
          .eq("user_id", user.id)
          .eq("url", result.url);

        setBookmarkedUrls(prev => {
          const newSet = new Set(prev);
          newSet.delete(result.url);
          return newSet;
        });

        toast.success("Bookmark removed");
      } else {
        await supabase.from("bookmarked_results").insert({
          user_id: user.id,
          url: result.url,
          title: result.title,
          description: result.description,
          domain: result.domain,
        });

        setBookmarkedUrls(prev => new Set(prev).add(result.url));
        toast.success("Result bookmarked");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to bookmark");
    }
  };

  const handleSaveSearch = async () => {
    if (!user) {
      toast.error("Please sign in to save searches");
      navigate("/auth");
      return;
    }

    if (!query.trim()) return;

    try {
      if (savedSearches.includes(query.trim())) {
        await supabase
          .from("saved_searches")
          .delete()
          .eq("user_id", user.id)
          .eq("query", query.trim());

        setSavedSearches(prev => prev.filter(s => s !== query.trim()));
        toast.success("Search removed from saved");
      } else {
        await supabase.from("saved_searches").insert({
          user_id: user.id,
          query: query.trim(),
        });

        setSavedSearches(prev => [...prev, query.trim()]);
        toast.success("Search saved");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save search");
    }
  };

  const handleSearch = useCallback(async (
    e?: React.FormEvent, 
    typeOverride?: SearchType, 
    queryOverride?: string
  ) => {
    if (e) e.preventDefault();
    
    const searchQuery = queryOverride || query;
    if (!searchQuery.trim()) return;

    const currentType = typeOverride || searchType;
    
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Update URL params
    setSearchParams({ q: searchQuery.trim(), type: currentType });

    // Check cache first
    const cacheKey = `${currentType}:${searchQuery.trim()}:${filters.timeRange}:${filters.region}`;
    const cached = getCached(searchQuery.trim(), `${currentType}:${filters.timeRange}:${filters.region}`);
    
    if (cached) {
      console.log("Using cached results");
      setSearchResults(cached.results);
      setAiSummary(cached.aiSummary);
      setAnswerBox(cached.answerBox);
      setKnowledgeGraph(cached.knowledgeGraph);
      setRelatedSearches(cached.relatedSearches);
      setTotalResults(cached.totalCount);
      setSearchTime(cached.searchTime);
      setHasSearched(true);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setAnswerBox(null);
    setKnowledgeGraph(null);
    setRelatedSearches([]);
    setSearchTime(0);

    const startTime = performance.now();

    try {
      const authHeader = user ? `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` : undefined;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader && { "Authorization": authHeader }),
          },
          body: JSON.stringify({ 
            query: searchQuery.trim(), 
            limit: 20, 
            offset: 0, 
            type: currentType,
            filters: {
              timeRange: filters.timeRange,
              region: filters.region,
              safeSearch: filters.safeSearch,
            }
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      const endTime = performance.now();
      const clientSearchTime = Math.round(endTime - startTime);

      setSearchResults(data.results || []);
      setAiSummary(data.ai_summary || "");
      setTotalResults(data.total || 0);
      setAnswerBox(data.answer_box || null);
      setKnowledgeGraph(data.knowledge_graph || null);
      setRelatedSearches(data.related_searches || []);
      setSearchTime(data.searchTime || clientSearchTime);

      // Cache the results
      setCached(searchQuery.trim(), `${currentType}:${filters.timeRange}:${filters.region}`, {
        results: data.results || [],
        aiSummary: data.ai_summary || "",
        answerBox: data.answer_box || null,
        knowledgeGraph: data.knowledge_graph || null,
        relatedSearches: data.related_searches || [],
        totalCount: data.total || 0,
        searchTime: data.searchTime || clientSearchTime,
      });

      if (data.results?.length === 0) {
        toast.error("No results found. Try different keywords.");
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Search aborted');
        return;
      }
      console.error("Search error:", error);
      toast.error(error.message || "Unable to perform search. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }, [query, searchType, filters, user, getCached, setCached, setSearchParams]);

  const handleResultClick = (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    
    const safetyResult = checkUrl(url);
    
    if (!safetyResult.isSafe) {
      setPendingUrl(url);
      setPendingSafetyResult(safetyResult);
      setWarningOpen(true);
    } else {
      openInBrowser(url);
    }
  };

  const openInBrowser = (url: string) => {
    navigate(`/browser?url=${encodeURIComponent(url)}`);
  };

  const handleSearchTypeChange = (type: SearchType) => {
    setSearchType(type);
    if (hasSearched && query.trim()) {
      handleSearch(undefined, type);
    }
  };

  const handleVoiceResult = (transcript: string) => {
    setQuery(transcript);
  };

  const triggerSearch = () => {
    formRef.current?.requestSubmit();
  };

  const renderStarRating = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span 
          key={i} 
          className={i <= rating ? "text-yellow-500" : "text-muted-foreground/30"}
        >
          ★
        </span>
      );
    }
    return <span className="text-sm">{stars}</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* AI Assistant */}
      <AIAssistant isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <AIAssistantTrigger onClick={() => setAssistantOpen(true)} />
      
      {/* Navigation */}
      <nav className="glass-effect border-b border-border/50 sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={alsamosLogo} alt="Alsamos" className="w-8 h-8 object-contain" />
            <span className="text-2xl font-display font-bold gradient-text">Alsamos</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="glass-effect">
                    <User className="w-4 h-4 mr-2" />
                    Account
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Settings className="w-4 h-4 mr-2" />
                    Admin Panel
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/auth">
                <Button variant="outline" size="sm" className="glass-effect">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Search Box */}
      <div
        className={`container mx-auto px-6 transition-all duration-300 ${
          hasSearched ? "pt-6" : "pt-32"
        }`}
      >
        <div className="max-w-3xl mx-auto">
          {!hasSearched && (
            <div className="text-center mb-12">
              <h1 className="text-5xl font-display font-bold mb-4">
                <span className="gradient-text">Alsamos Search</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                AI-powered search with voice commands and smart results
              </p>
            </div>
          )}

          <form ref={formRef} onSubmit={handleSearch} className="relative">
            <div className="glass-effect rounded-full p-2 shadow-premium">
              <div className="flex items-center gap-2">
                <SearchIcon className="w-5 h-5 text-muted-foreground ml-4" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search anything..."
                  className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-lg"
                  autoComplete="off"
                />
                <VoiceSearch onResult={handleVoiceResult} onSearchTrigger={triggerSearch} />
                {user && query && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveSearch}
                    className="mr-2"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        savedSearches.includes(query.trim())
                          ? "fill-yellow-500 text-yellow-500"
                          : ""
                      }`}
                    />
                  </Button>
                )}
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSearching}
                  className="rounded-full bg-gradient-primary hover:opacity-90 transition-opacity"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <SearchSuggestions
              query={query}
              isOpen={showSuggestions && !hasSearched}
              onSelect={(suggestion) => {
                setQuery(suggestion);
                setShowSuggestions(false);
                inputRef.current?.focus();
              }}
              onClose={() => setShowSuggestions(false)}
            />
          </form>

          {/* Search Type Tabs */}
          {hasSearched && (
            <div className="mt-4 space-y-3">
              <Tabs value={searchType} onValueChange={(v) => handleSearchTypeChange(v as SearchType)}>
                <TabsList className="glass-effect">
                  <TabsTrigger value="search" className="gap-2">
                    <Globe className="w-4 h-4" />
                    All
                  </TabsTrigger>
                  <TabsTrigger value="images" className="gap-2">
                    <Image className="w-4 h-4" />
                    Images
                  </TabsTrigger>
                  <TabsTrigger value="news" className="gap-2">
                    <Newspaper className="w-4 h-4" />
                    News
                  </TabsTrigger>
                  <TabsTrigger value="videos" className="gap-2">
                    <Video className="w-4 h-4" />
                    Videos
                  </TabsTrigger>
                  <TabsTrigger value="shopping" className="gap-2">
                    <ShoppingBag className="w-4 h-4" />
                    Shopping
                  </TabsTrigger>
                  <TabsTrigger value="academic" className="gap-2">
                    <GraduationCap className="w-4 h-4" />
                    Academic
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filters */}
              <SearchFilters 
                filters={filters} 
                onFiltersChange={(newFilters) => {
                  setFilters(newFilters);
                  // Re-search with new filters
                  if (query.trim()) {
                    setTimeout(() => handleSearch(), 0);
                  }
                }}
                searchType={searchType}
              />
            </div>
          )}

          {!hasSearched && user && savedSearches.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <History className="w-4 h-4" />
                Saved Searches
              </h3>
              <div className="flex flex-wrap gap-3">
                {savedSearches.map((search) => (
                  <Button
                    key={search}
                    variant="outline"
                    size="sm"
                    className="glass-effect"
                    onClick={() => {
                      setQuery(search);
                      setTimeout(() => formRef.current?.requestSubmit(), 0);
                    }}
                  >
                    {search}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {!hasSearched && !user && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {["artificial intelligence", "quantum computing", "climate tech", "space exploration"].map((term) => (
                <Button
                  key={term}
                  variant="outline"
                  size="sm"
                  className="glass-effect"
                  onClick={() => {
                    setQuery(term);
                    setTimeout(() => formRef.current?.requestSubmit(), 0);
                  }}
                >
                  {term}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search Results */}
      {hasSearched && (
        <div className="container mx-auto px-6 py-8">
          <div className="max-w-5xl mx-auto">
            {/* Loading State with Skeletons */}
            {isSearching ? (
              <SearchResultSkeleton type={searchType} count={5} />
            ) : (
              <>
                {/* Knowledge Graph */}
                {knowledgeGraph && searchType === "search" && (
                  <Card className="glass-effect p-6 mb-6 border-2 border-primary/20">
                    <div className="flex items-start gap-4">
                      {knowledgeGraph.imageUrl && (
                        <img 
                          src={knowledgeGraph.imageUrl} 
                          alt={knowledgeGraph.title}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      )}
                      <div>
                        <h2 className="text-xl font-display font-bold">{knowledgeGraph.title}</h2>
                        <p className="text-sm text-muted-foreground mb-2">{knowledgeGraph.type}</p>
                        <p className="text-foreground">{knowledgeGraph.description}</p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Answer Box */}
                {answerBox && searchType === "search" && (
                  <Card className="glass-effect p-6 mb-6 border-2 border-secondary/30 bg-secondary/5">
                    <h3 className="font-display font-semibold mb-2">{answerBox.title}</h3>
                    <p className="text-foreground text-lg mb-2">{answerBox.answer || answerBox.snippet}</p>
                    <button 
                      onClick={(e) => handleResultClick(answerBox.link, e)}
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      Open in Browser <ExternalLink className="w-3 h-3" />
                    </button>
                  </Card>
                )}

                {/* AI Summary */}
                {aiSummary && searchType === "search" && (
                  <Card className="glass-effect p-6 mb-8 shadow-glass border-2">
                    <div className="flex items-center gap-2 mb-4">
                      <Brain className="w-5 h-5 text-primary" />
                      <span className="font-display font-semibold">AI Overview</span>
                      <Sparkles className="w-4 h-4 text-secondary" />
                    </div>
                    <div 
                      className="text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: aiSummary
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br />') 
                      }}
                    />
                  </Card>
                )}

                {/* Search Results List */}
                {searchResults.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        About {totalResults} results from the web
                      </p>
                      {searchTime > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {searchTime}ms
                        </p>
                      )}
                    </div>

                    {/* Image Grid Layout */}
                    {searchType === "images" ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {searchResults.map((result, index) => (
                          <Card
                            key={`${result.url}-${index}`}
                            className="glass-effect overflow-hidden hover:shadow-hover transition-all duration-300 cursor-pointer group"
                            onClick={(e) => handleResultClick(result.url, e)}
                          >
                            <div className="aspect-square bg-muted relative">
                              <img
                                src={result.imageUrl || result.thumbnailUrl || "/placeholder.svg"}
                                alt={result.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                <p className="text-sm font-medium line-clamp-2">{result.title}</p>
                              </div>
                            </div>
                            <div className="p-2">
                              <p className="text-xs text-muted-foreground truncate">{result.domain}</p>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : searchType === "news" ? (
                      /* News Layout */
                      <div className="space-y-4">
                        {searchResults.map((result, index) => (
                          <Card
                            key={`${result.url}-${index}`}
                            className="glass-effect p-4 hover:shadow-hover transition-all duration-300 border-2"
                          >
                            <div className="flex gap-4">
                              {result.imageUrl && (
                                <img
                                  src={result.imageUrl}
                                  alt={result.title}
                                  className="w-32 h-24 object-cover rounded-lg flex-shrink-0"
                                  loading="lazy"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                  <span>{result.domain}</span>
                                  {result.date && (
                                    <>
                                      <span>•</span>
                                      <span>{result.date}</span>
                                    </>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => handleResultClick(result.url, e)}
                                  className="text-lg font-display font-semibold text-primary hover:underline mb-2 block text-left"
                                >
                                  <HighlightedText text={result.title} query={query} />
                                </button>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  <HighlightedText text={result.description} query={query} />
                                </p>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : searchType === "videos" ? (
                      /* Video Layout */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {searchResults.map((result, index) => (
                          <Card
                            key={`${result.url}-${index}`}
                            className="glass-effect overflow-hidden hover:shadow-hover transition-all duration-300 cursor-pointer group"
                            onClick={(e) => handleResultClick(result.url, e)}
                          >
                            <div className="aspect-video bg-muted relative">
                              <img
                                src={result.thumbnailUrl || result.imageUrl || "/placeholder.svg"}
                                alt={result.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-background/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
                                  <Play className="w-8 h-8 text-primary-foreground ml-1" />
                                </div>
                              </div>
                              {result.duration && (
                                <div className="absolute bottom-2 right-2 bg-background/90 text-foreground text-xs px-2 py-1 rounded flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {result.duration}
                                </div>
                              )}
                            </div>
                            <div className="p-3">
                              <h3 className="font-display font-semibold line-clamp-2 text-sm mb-1">
                                {result.title}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {result.channel && (
                                  <span className="truncate">{result.channel}</span>
                                )}
                                {result.channel && result.date && <span>•</span>}
                                {result.date && <span>{result.date}</span>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {result.domain}
                              </p>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : searchType === "shopping" ? (
                      /* Shopping Layout */
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {searchResults.map((result, index) => (
                          <Card
                            key={`${result.url}-${index}`}
                            className="glass-effect overflow-hidden hover:shadow-hover transition-all duration-300 cursor-pointer group p-4"
                            onClick={(e) => handleResultClick(result.url, e)}
                          >
                            <div className="aspect-square bg-muted rounded-lg mb-3 relative overflow-hidden">
                              <img
                                src={result.imageUrl || "/placeholder.svg"}
                                alt={result.title}
                                className="w-full h-full object-contain p-2"
                                loading="lazy"
                              />
                            </div>
                            <h3 className="font-medium text-sm line-clamp-2 mb-2">
                              {result.title}
                            </h3>
                            {result.rating && (
                              <div className="flex items-center gap-1 mb-1">
                                {renderStarRating(result.rating)}
                                {result.ratingCount && (
                                  <span className="text-xs text-muted-foreground">
                                    ({result.ratingCount})
                                  </span>
                                )}
                              </div>
                            )}
                            {result.price && (
                              <p className="text-lg font-bold text-primary">{result.price}</p>
                            )}
                            {result.merchant && (
                              <p className="text-xs text-muted-foreground mt-1">{result.merchant}</p>
                            )}
                          </Card>
                        ))}
                      </div>
                    ) : searchType === "academic" ? (
                      /* Academic/Scholar Layout */
                      <div className="space-y-4">
                        {searchResults.map((result, index) => (
                          <Card
                            key={`${result.url}-${index}`}
                            className="glass-effect p-6 hover:shadow-hover transition-all duration-300 border-2"
                          >
                            <div className="flex items-start gap-3 mb-2">
                              <GraduationCap className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                              <div className="flex-1">
                                <button
                                  onClick={(e) => handleResultClick(result.url, e)}
                                  className="text-lg font-display font-semibold text-primary hover:underline mb-2 block text-left"
                                >
                                  <HighlightedText text={result.title} query={query} />
                                </button>
                                {result.authors && result.authors.length > 0 && (
                                  <p className="text-sm text-muted-foreground mb-1">
                                    {result.authors.join(", ")}
                                    {result.year && ` • ${result.year}`}
                                  </p>
                                )}
                                <p className="text-sm text-foreground line-clamp-3 mb-3">
                                  <HighlightedText text={result.description} query={query} />
                                </p>
                                <div className="flex items-center gap-3 text-xs">
                                  {result.citedBy !== undefined && result.citedBy > 0 && (
                                    <span className="bg-primary/10 text-primary px-2 py-1 rounded-full">
                                      Cited by {result.citedBy}
                                    </span>
                                  )}
                                  {result.publication && (
                                    <span className="text-muted-foreground truncate">
                                      {result.publication}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      /* Regular Search Results */
                      <div className="space-y-6">
                        {searchResults.map((result, index) => (
                          <Card
                            key={`${result.url}-${index}`}
                            className="glass-effect p-6 hover:shadow-hover transition-all duration-300 border-2"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                  <Globe className="w-4 h-4" />
                                  <span>{result.domain}</span>
                                  {result.source === "web" && (
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                      Live
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => handleResultClick(result.url, e)}
                                  className="text-xl font-display font-semibold text-primary hover:underline mb-2 block text-left"
                                >
                                  <HighlightedText text={result.title} query={query} />
                                </button>
                                <p className="text-foreground">
                                  <HighlightedText text={result.description} query={query} />
                                </p>
                                {/* Sitelinks */}
                                {result.sitelinks && result.sitelinks.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {result.sitelinks.slice(0, 4).map((link, i) => (
                                      <button
                                        key={i}
                                        onClick={(e) => handleResultClick(link.link, e)}
                                        className="text-sm text-primary/80 hover:text-primary hover:underline flex items-center gap-1"
                                      >
                                        <ChevronRight className="w-3 h-3" />
                                        {link.title}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {user && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleBookmark(result)}
                                >
                                  <Bookmark
                                    className={`w-5 h-5 ${
                                      bookmarkedUrls.has(result.url)
                                        ? "fill-primary text-primary"
                                        : ""
                                    }`}
                                  />
                                </Button>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Related Searches */}
                    {relatedSearches.length > 0 && searchType === "search" && (
                      <div className="mt-8 pt-6 border-t border-border">
                        <h3 className="text-sm font-medium text-muted-foreground mb-3">Related searches</h3>
                        <div className="flex flex-wrap gap-2">
                          {relatedSearches.map((search) => (
                            <Button
                              key={search}
                              variant="outline"
                              size="sm"
                              className="glass-effect"
                              onClick={() => {
                                setQuery(search);
                                setTimeout(() => handleSearch(), 0);
                              }}
                            >
                              <SearchIcon className="w-3 h-3 mr-2" />
                              {search}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : !isSearching ? (
                  <div className="text-center py-12">
                    <Globe className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-display font-semibold mb-2">
                      No results found
                    </h3>
                    <p className="text-muted-foreground">
                      Try different keywords or check your spelling
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer (when no search) */}
      {!hasSearched && (
        <div className="absolute bottom-8 left-0 right-0">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto space-y-6">
              <UrlSubmit />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Alsamos Search • AI-Powered • Privacy-focused
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safe Browsing Warning Dialog */}
      {pendingSafetyResult && (
        <SafeBrowsingWarning
          isOpen={warningOpen}
          onClose={() => {
            setWarningOpen(false);
            setPendingUrl("");
            setPendingSafetyResult(null);
          }}
          onProceed={() => {
            setWarningOpen(false);
            openInBrowser(pendingUrl);
            setPendingUrl("");
            setPendingSafetyResult(null);
          }}
          url={pendingUrl}
          safetyResult={pendingSafetyResult}
        />
      )}
    </div>
  );
};

export default Search;
