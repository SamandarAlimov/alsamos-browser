import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Globe,
  Loader2,
  Play,
  Database,
  Activity,
  ArrowLeft,
  Ban,
  CheckCircle,
  Trash2,
  Plus,
} from "lucide-react";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

const AdminAdvanced = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  
  const [stats, setStats] = useState({
    indexedPages: 0,
    queuedUrls: 0,
    totalQueries: 0,
  });

  const [whitelist, setWhitelist] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [blacklistReason, setBlacklistReason] = useState("");

  const [searchTrends, setSearchTrends] = useState<any[]>([]);
  const [topDomains, setTopDomains] = useState<any[]>([]);
  const [crawlStatus, setCrawlStatus] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in to access admin panel");
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const hasAdminRole = roles?.some(r => r.role === "admin");
      
      if (!hasAdminRole) {
        toast.error("Unauthorized: Admin access required");
        navigate("/search");
        return;
      }

      setIsAdmin(true);
      loadAllData();
    } catch (error) {
      console.error("Auth check error:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async () => {
    await Promise.all([
      loadStats(),
      loadDomainLists(),
      loadAnalytics(),
    ]);
  };

  const loadStats = async () => {
    const [indexedResult, queueResult, queriesResult] = await Promise.all([
      supabase.from("indexed_pages").select("id", { count: "exact", head: true }),
      supabase.from("crawl_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("search_queries").select("id", { count: "exact", head: true }),
    ]);

    setStats({
      indexedPages: indexedResult.count || 0,
      queuedUrls: queueResult.count || 0,
      totalQueries: queriesResult.count || 0,
    });
  };

  const loadDomainLists = async () => {
    const [whitelistResult, blacklistResult] = await Promise.all([
      supabase.from("domain_whitelist").select("*").order("created_at", { ascending: false }),
      supabase.from("domain_blacklist").select("*").order("created_at", { ascending: false }),
    ]);

    setWhitelist(whitelistResult.data || []);
    setBlacklist(blacklistResult.data || []);
  };

  const loadAnalytics = async () => {
    // Search trends (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: queries } = await supabase
      .from("search_queries")
      .select("created_at, query")
      .gte("created_at", sevenDaysAgo.toISOString());

    // Group by date
    const trendMap = new Map();
    queries?.forEach(q => {
      const date = new Date(q.created_at).toLocaleDateString();
      trendMap.set(date, (trendMap.get(date) || 0) + 1);
    });

    setSearchTrends(
      Array.from(trendMap.entries()).map(([date, count]) => ({
        date,
        searches: count,
      }))
    );

    // Top domains
    const { data: pages } = await supabase
      .from("indexed_pages")
      .select("domain")
      .limit(1000);

    const domainMap = new Map();
    pages?.forEach(p => {
      if (p.domain) {
        domainMap.set(p.domain, (domainMap.get(p.domain) || 0) + 1);
      }
    });

    setTopDomains(
      Array.from(domainMap.entries())
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    );

    // Crawl status distribution
    const { data: queueStatus } = await supabase
      .from("crawl_queue")
      .select("status");

    const statusMap = new Map();
    queueStatus?.forEach(q => {
      statusMap.set(q.status, (statusMap.get(q.status) || 0) + 1);
    });

    setCrawlStatus(
      Array.from(statusMap.entries()).map(([status, count]) => ({
        status,
        count,
      }))
    );
  };

  const handleAddToWhitelist = async () => {
    if (!newDomain.trim()) return;

    try {
      const { error } = await supabase.from("domain_whitelist").insert({
        domain: newDomain.trim().toLowerCase(),
      });

      if (error) throw error;

      toast.success("Domain added to whitelist");
      setNewDomain("");
      loadDomainLists();
    } catch (error: any) {
      toast.error(error.message || "Failed to add domain");
    }
  };

  const handleAddToBlacklist = async () => {
    if (!newDomain.trim()) return;

    try {
      const { error } = await supabase.from("domain_blacklist").insert({
        domain: newDomain.trim().toLowerCase(),
        reason: blacklistReason.trim() || null,
      });

      if (error) throw error;

      toast.success("Domain added to blacklist");
      setNewDomain("");
      setBlacklistReason("");
      loadDomainLists();
    } catch (error: any) {
      toast.error(error.message || "Failed to add domain");
    }
  };

  const handleRemoveFromList = async (id: string, table: "domain_whitelist" | "domain_blacklist") => {
    try {
      const { error } = await supabase.from(table).delete().eq("id", id);

      if (error) throw error;

      toast.success("Domain removed");
      loadDomainLists();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove domain");
    }
  };

  const handleStartCrawl = async () => {
    setIsCrawling(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crawl`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ maxUrls: 10 }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`Crawl started! Processing ${data.crawled} URLs`);
        setTimeout(loadAllData, 2000);
      } else {
        throw new Error(data.error || "Crawl failed");
      }
    } catch (error: any) {
      toast.error(error.message || "Unable to start crawler");
    } finally {
      setIsCrawling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <nav className="glass-effect border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Globe className="w-8 h-8 text-primary" />
            <span className="text-2xl font-display font-bold gradient-text">SearchAI Admin</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/search">
              <Button variant="outline" size="sm" className="glass-effect">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Search
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-display font-bold mb-2 gradient-text">
            Advanced Admin Dashboard
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Comprehensive management and analytics
          </p>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="glass-effect p-6 hover:shadow-hover transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Database className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Indexed Pages</p>
                  <p className="text-2xl font-display font-bold">{stats.indexedPages}</p>
                </div>
              </div>
            </Card>

            <Card className="glass-effect p-6 hover:shadow-hover transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-accent flex items-center justify-center">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Queued URLs</p>
                  <p className="text-2xl font-display font-bold">{stats.queuedUrls}</p>
                </div>
              </div>
            </Card>

            <Card className="glass-effect p-6 hover:shadow-hover transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Searches</p>
                  <p className="text-2xl font-display font-bold">{stats.totalQueries}</p>
                </div>
              </div>
            </Card>
          </div>

          <Tabs defaultValue="crawler" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="crawler">Crawler Control</TabsTrigger>
              <TabsTrigger value="domains">Domain Management</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="crawler" className="space-y-6">
              <Card className="glass-effect p-8 shadow-premium">
                <h2 className="text-2xl font-display font-bold mb-4">Crawler Control</h2>
                <p className="text-muted-foreground mb-6">
                  Start the web crawler to index URLs from the queue with AI-powered semantic embeddings.
                </p>

                <Button
                  size="lg"
                  onClick={handleStartCrawl}
                  disabled={isCrawling || stats.queuedUrls === 0}
                  className="bg-gradient-primary hover:opacity-90 transition-opacity"
                >
                  {isCrawling ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Crawling...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Start Crawler
                    </>
                  )}
                </Button>

                {stats.queuedUrls === 0 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    No URLs in queue. Submit some URLs first.
                  </p>
                )}
              </Card>

              {/* Crawl Status Chart */}
              {crawlStatus.length > 0 && (
                <Card className="glass-effect p-8">
                  <h3 className="text-xl font-display font-bold mb-4">Crawl Queue Status</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={crawlStatus}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {crawlStatus.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="domains" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Whitelist */}
                <Card className="glass-effect p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <h3 className="text-xl font-display font-bold">Whitelist</h3>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <Input
                      placeholder="example.com"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                    />
                    <Button onClick={handleAddToWhitelist} className="w-full" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add to Whitelist
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {whitelist.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded"
                      >
                        <span className="text-sm">{item.domain}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveFromList(item.id, "domain_whitelist")}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Blacklist */}
                <Card className="glass-effect p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Ban className="w-5 h-5 text-destructive" />
                    <h3 className="text-xl font-display font-bold">Blacklist</h3>
                  </div>

                  <div className="space-y-3 mb-4">
                    <Input
                      placeholder="example.com"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                    />
                    <Input
                      placeholder="Reason (optional)"
                      value={blacklistReason}
                      onChange={(e) => setBlacklistReason(e.target.value)}
                    />
                    <Button
                      onClick={handleAddToBlacklist}
                      variant="destructive"
                      className="w-full"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add to Blacklist
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {blacklist.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded"
                      >
                        <div className="flex-1">
                          <span className="text-sm block">{item.domain}</span>
                          {item.reason && (
                            <span className="text-xs text-muted-foreground">{item.reason}</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveFromList(item.id, "domain_blacklist")}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              {/* Search Trends */}
              {searchTrends.length > 0 && (
                <Card className="glass-effect p-8">
                  <h3 className="text-xl font-display font-bold mb-4">Search Trends (Last 7 Days)</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={searchTrends}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="searches"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Top Domains */}
              {topDomains.length > 0 && (
                <Card className="glass-effect p-8">
                  <h3 className="text-xl font-display font-bold mb-4">Top Indexed Domains</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topDomains}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="domain" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminAdvanced;
