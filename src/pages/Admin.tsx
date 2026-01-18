import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { 
  Globe, 
  Loader2, 
  Play, 
  Database, 
  Activity,
  ArrowLeft 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Admin = () => {
  const { toast } = useToast();
  const [isCrawling, setIsCrawling] = useState(false);
  const [stats, setStats] = useState({
    indexedPages: 0,
    queuedUrls: 0,
    totalQueries: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [indexedResult, queueResult, queriesResult] = await Promise.all([
        supabase.from('indexed_pages').select('id', { count: 'exact', head: true }),
        supabase.from('crawl_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('search_queries').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        indexedPages: indexedResult.count || 0,
        queuedUrls: queueResult.count || 0,
        totalQueries: queriesResult.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleStartCrawl = async () => {
    setIsCrawling(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crawl`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ maxUrls: 5 }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Crawl started!",
          description: `Processing ${data.crawled} URLs from the queue`,
        });
        
        // Reload stats after crawl
        setTimeout(loadStats, 2000);
      } else {
        throw new Error(data.error || 'Crawl failed');
      }
    } catch (error: any) {
      console.error('Crawl error:', error);
      toast({
        title: "Crawl failed",
        description: error.message || "Unable to start crawler. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCrawling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="glass-effect border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Globe className="w-8 h-8 text-primary" />
            <span className="text-2xl font-display font-bold gradient-text">Alsamos</span>
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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-display font-bold mb-2">
            <span className="gradient-text">Search Engine Admin</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Manage crawling and indexing operations
          </p>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="glass-effect p-6">
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

            <Card className="glass-effect p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Queued URLs</p>
                  <p className="text-2xl font-display font-bold">{stats.queuedUrls}</p>
                </div>
              </div>
            </Card>

            <Card className="glass-effect p-6">
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

          {/* Crawler Control */}
          <Card className="glass-effect p-8 shadow-premium">
            <h2 className="text-2xl font-display font-bold mb-4">Crawler Control</h2>
            <p className="text-muted-foreground mb-6">
              Start the web crawler to index URLs from the queue. The crawler will
              process up to 5 URLs at a time and automatically discover new pages.
            </p>

            <Button
              size="lg"
              onClick={handleStartCrawl}
              disabled={isCrawling || stats.queuedUrls === 0}
              className="bg-gradient-primary hover:opacity-90 transition-opacity w-full md:w-auto"
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
                No URLs in queue. <Link to="/search" className="text-primary hover:underline">Submit some URLs</Link> first.
              </p>
            )}
          </Card>

          {/* Recent Activity */}
          <Card className="glass-effect p-8 mt-8">
            <h2 className="text-2xl font-display font-bold mb-4">System Status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Database</span>
                <span className="text-sm font-medium text-green-500">● Operational</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Search API</span>
                <span className="text-sm font-medium text-green-500">● Operational</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Crawler</span>
                <span className="text-sm font-medium text-green-500">● Ready</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Admin;
