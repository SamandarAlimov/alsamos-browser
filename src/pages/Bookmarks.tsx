import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Globe,
  Bookmark,
  Search,
  Trash2,
  ExternalLink,
  Filter,
  X,
  Loader2,
  User,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface BookmarkItem {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  domain: string | null;
  created_at: string | null;
}

const Bookmarks = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState<BookmarkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [domains, setDomains] = useState<string[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      } else {
        loadBookmarks(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadBookmarks = async (userId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("bookmarked_results")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setBookmarks(data || []);
      setFilteredBookmarks(data || []);

      // Extract unique domains
      const uniqueDomains = [...new Set((data || []).map(b => b.domain).filter(Boolean))] as string[];
      setDomains(uniqueDomains);
    } catch (error: any) {
      toast.error("Failed to load bookmarks");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let filtered = bookmarks;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        b =>
          b.title?.toLowerCase().includes(query) ||
          b.description?.toLowerCase().includes(query) ||
          b.url.toLowerCase().includes(query)
      );
    }

    if (selectedDomain) {
      filtered = filtered.filter(b => b.domain === selectedDomain);
    }

    setFilteredBookmarks(filtered);
  }, [searchQuery, selectedDomain, bookmarks]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("bookmarked_results")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setBookmarks(prev => prev.filter(b => b.id !== id));
      toast.success("Bookmark deleted");
    } catch (error: any) {
      toast.error("Failed to delete bookmark");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const openInBrowser = (url: string) => {
    navigate(`/browser?url=${encodeURIComponent(url)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="glass-effect border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Globe className="w-8 h-8 text-primary" />
            <span className="text-2xl font-display font-bold gradient-text">SearchAI</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/search">
              <Button variant="ghost" size="sm">
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </Link>
            <Link to="/history">
              <Button variant="ghost" size="sm">
                History
              </Button>
            </Link>
            <ThemeToggle />
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="glass-effect">
                    <User className="w-4 h-4 mr-2" />
                    Account
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    Admin Panel
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-display font-bold gradient-text mb-2">
                <Bookmark className="w-8 h-8 inline mr-3" />
                My Bookmarks
              </h1>
              <p className="text-muted-foreground">
                {bookmarks.length} saved {bookmarks.length === 1 ? "result" : "results"}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bookmarks..."
                className="pl-10 glass-effect"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="glass-effect">
                  <Filter className="w-4 h-4 mr-2" />
                  {selectedDomain || "All Domains"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 overflow-auto">
                <DropdownMenuItem onClick={() => setSelectedDomain(null)}>
                  All Domains
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {domains.map((domain) => (
                  <DropdownMenuItem
                    key={domain}
                    onClick={() => setSelectedDomain(domain)}
                  >
                    {domain}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Active Filters */}
          {(searchQuery || selectedDomain) && (
            <div className="flex gap-2 mb-4">
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: {searchQuery}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => setSearchQuery("")}
                  />
                </Badge>
              )}
              {selectedDomain && (
                <Badge variant="secondary" className="gap-1">
                  Domain: {selectedDomain}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => setSelectedDomain(null)}
                  />
                </Badge>
              )}
            </div>
          )}

          {/* Bookmarks List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredBookmarks.length > 0 ? (
            <div className="space-y-4">
              {filteredBookmarks.map((bookmark) => (
                <Card
                  key={bookmark.id}
                  className="glass-effect p-4 hover:shadow-hover transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Globe className="w-4 h-4" />
                        <span>{bookmark.domain}</span>
                        <span className="text-xs">
                          {bookmark.created_at &&
                            new Date(bookmark.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        onClick={() => openInBrowser(bookmark.url)}
                        className="text-lg font-display font-semibold text-primary hover:underline mb-1 block text-left truncate w-full"
                      >
                        {bookmark.title || bookmark.url}
                      </button>
                      {bookmark.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {bookmark.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openInBrowser(bookmark.url)}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(bookmark.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Bookmark className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-display font-semibold mb-2">
                {searchQuery || selectedDomain ? "No matching bookmarks" : "No bookmarks yet"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || selectedDomain
                  ? "Try adjusting your filters"
                  : "Start searching and bookmark results you want to save"}
              </p>
              <Link to="/search">
                <Button>
                  <Search className="w-4 h-4 mr-2" />
                  Start Searching
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Bookmarks;
