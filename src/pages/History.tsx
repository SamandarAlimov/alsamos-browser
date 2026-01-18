import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Globe,
  History as HistoryIcon,
  Search,
  Trash2,
  Loader2,
  User,
  LogOut,
  Calendar,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface HistoryItem {
  id: string;
  query: string;
  results_count: number | null;
  created_at: string | null;
}

type DateFilter = "all" | "today" | "week" | "month";

const History = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

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
        loadHistory(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadHistory = async (userId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("search_history")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setHistory(data || []);
      setFilteredHistory(data || []);
    } catch (error: any) {
      toast.error("Failed to load history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let filtered = history;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(h => h.query.toLowerCase().includes(query));
    }

    // Apply date filter
    if (dateFilter !== "all") {
      const now = new Date();
      let cutoffDate: Date;

      switch (dateFilter) {
        case "today":
          cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      filtered = filtered.filter(h => {
        if (!h.created_at) return false;
        return new Date(h.created_at) >= cutoffDate;
      });
    }

    setFilteredHistory(filtered);
  }, [searchQuery, dateFilter, history]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("search_history")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setHistory(prev => prev.filter(h => h.id !== id));
      toast.success("Search deleted from history");
    } catch (error: any) {
      toast.error("Failed to delete from history");
    }
  };

  const handleClearAll = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("search_history")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setHistory([]);
      toast.success("Search history cleared");
    } catch (error: any) {
      toast.error("Failed to clear history");
    }
  };

  const handleSearchAgain = (query: string) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "long" });
    } else {
      return date.toLocaleDateString();
    }
  };

  // Group history by date
  const groupedHistory = filteredHistory.reduce((groups, item) => {
    if (!item.created_at) return groups;
    const date = new Date(item.created_at);
    const key = date.toLocaleDateString();
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, HistoryItem[]>);

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
            <Link to="/bookmarks">
              <Button variant="ghost" size="sm">
                Bookmarks
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
                <HistoryIcon className="w-8 h-8 inline mr-3" />
                Search History
              </h1>
              <p className="text-muted-foreground">
                {history.length} {history.length === 1 ? "search" : "searches"}
              </p>
            </div>
            {history.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all search history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. All your search history will be
                      permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll}>
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter history..."
                className="pl-10 glass-effect"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="glass-effect">
                  <Calendar className="w-4 h-4 mr-2" />
                  {dateFilter === "all"
                    ? "All Time"
                    : dateFilter === "today"
                    ? "Today"
                    : dateFilter === "week"
                    ? "This Week"
                    : "This Month"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDateFilter("all")}>
                  All Time
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter("today")}>
                  Today
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter("week")}>
                  This Week
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter("month")}>
                  This Month
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* History List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : Object.keys(groupedHistory).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(groupedHistory).map(([date, items]) => (
                <div key={date}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {date}
                  </h3>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <Card
                        key={item.id}
                        className="glass-effect p-4 hover:shadow-hover transition-all duration-300 group"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => handleSearchAgain(item.query)}
                          >
                            <div className="flex items-center gap-3">
                              <Search className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-primary hover:underline">
                                {item.query}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 ml-7 text-xs text-muted-foreground">
                              <span>{formatDate(item.created_at)}</span>
                              {item.results_count !== null && (
                                <>
                                  <span>•</span>
                                  <span>{item.results_count} results</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <HistoryIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-display font-semibold mb-2">
                {searchQuery || dateFilter !== "all"
                  ? "No matching history"
                  : "No search history yet"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || dateFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Your search history will appear here"}
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

export default History;
