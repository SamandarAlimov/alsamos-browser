import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  ArrowRight, 
  RefreshCw, 
  Home, 
  Star, 
  Menu,
  Plus,
  X,
  Globe,
  Lock,
  Shield,
  Search,
  ExternalLink,
  Loader2,
  Bookmark,
  MoreVertical,
  Download,
  Settings,
  History,
  User,
  Grid3X3,
  ChevronDown,
  Pin,
  EyeOff,
  RotateCcw,
  Puzzle,
  Moon,
  Eye,
  Zap
} from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BookmarksManager } from "@/components/BookmarksManager";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { NewTabPage } from "@/components/browser/NewTabPage";
import { BrowserSearchBar } from "@/components/browser/BrowserSearchBar";
import { DownloadsManager, DownloadItem } from "@/components/browser/DownloadsManager";
import { ExtensionsManager, Extension } from "@/components/browser/ExtensionsManager";
import { useBrowserSession } from "@/hooks/useBrowserSession";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Tab {
  id: string;
  url: string;
  title: string;
  history: string[];
  historyIndex: number;
  favicon?: string;
  isNewTab?: boolean;
  pinned?: boolean;
  incognito?: boolean;
}

// Extension icon mapping for serialization/deserialization
const extensionIcons: Record<string, React.ReactNode> = {
  'dark-reader': <Moon className="w-6 h-6 text-yellow-400" />,
  'privacy-badger': <Eye className="w-6 h-6 text-orange-400" />,
  'ublock-origin': <Shield className="w-6 h-6 text-red-400" />,
  'bitwarden': <Lock className="w-6 h-6 text-blue-400" />,
  'grammarly': <Zap className="w-6 h-6 text-green-400" />,
  'translate': <Globe className="w-6 h-6 text-purple-400" />,
};

const Browser = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialUrl = searchParams.get("url") || "https://www.google.com";
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Sites that we'll use proxy for
  const proxyDomains = [
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'tiktok.com', 'linkedin.com', 'reddit.com',
    'telegram.org', 'whatsapp.com', 'snapchat.com', 'pinterest.com',
    'github.com', 'netflix.com', 'amazon.com', 'google.com', 'youtube.com'
  ];

  const needsProxy = (url: string): boolean => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return proxyDomains.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain)
      );
    } catch {
      return false;
    }
  };

  const hasInitialUrl = searchParams.get("url") !== null;

  // Default extensions for new sessions
  const defaultExtensions = useMemo(() => [
    {
      id: "dark-reader",
      name: "Dark Reader",
      description: "Dark mode for every website. Take care of your eyes, use dark theme for night and daily browsing.",
      icon: <Moon className="w-6 h-6 text-yellow-400" />,
      version: "4.9.80",
      author: "Dark Reader Ltd",
      category: "security" as const,
      permissions: ["Read and change all your data on all websites"],
      size: "1.2 MB",
      enabled: true
    },
    {
      id: "privacy-badger",
      name: "Privacy Badger",
      description: "Privacy Badger automatically learns to block invisible trackers.",
      icon: <Eye className="w-6 h-6 text-orange-400" />,
      version: "2024.2.6",
      author: "EFF",
      category: "privacy" as const,
      permissions: ["Read and change all your data on all websites"],
      size: "2.1 MB",
      enabled: true
    }
  ], []);

  const defaultTabs = useMemo(() => [
    { 
      id: "1", 
      url: hasInitialUrl ? initialUrl : "",
      title: hasInitialUrl ? getHostname(initialUrl) : "New Tab",
      history: hasInitialUrl ? [initialUrl] : [],
      historyIndex: hasInitialUrl ? 0 : -1,
      isNewTab: !hasInitialUrl
    }
  ], [hasInitialUrl, initialUrl]);

  // Serialization functions for extensions
  const serializeExtension = (ext: Extension) => ({
    id: ext.id,
    name: ext.name,
    description: ext.description,
    version: ext.version,
    author: ext.author,
    category: ext.category,
    permissions: ext.permissions,
    size: ext.size,
    enabled: ext.enabled,
  });

  const deserializeExtension = (ext: { id: string; name: string; description: string; version: string; author: string; category: string; permissions: string[]; size: string; enabled: boolean }): Extension => ({
    ...ext,
    icon: extensionIcons[ext.id] || <Puzzle className="w-6 h-6 text-gray-400" />,
    category: ext.category as Extension['category'],
  });

  // Use the browser session hook for persistence
  const {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    extensions,
    setExtensions,
    downloads,
    setDownloads,
    closedTabs,
    setClosedTabs,
    isLoading: isSessionLoading,
    isLoggedIn,
  } = useBrowserSession({
    defaultTabs,
    defaultActiveTabId: "1",
    defaultExtensions,
    serializeExtension,
    deserializeExtension,
  });

  const [urlInput, setUrlInput] = useState(hasInitialUrl ? initialUrl : "");
  const [isLoading, setIsLoading] = useState(false);
  const [proxyContent, setProxyContent] = useState<string | null>(null);
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [useProxy, setUseProxy] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);
  const [showExtensions, setShowExtensions] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  } | null>(null);

  // Fetch user profile when logged in
  useEffect(() => {
    const fetchProfile = async () => {
      if (!isLoggedIn) {
        setUserProfile(null);
        return;
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, email')
          .eq('id', user.id)
          .maybeSingle();
        
        setUserProfile({
          email: profile?.email || user.email,
          displayName: profile?.display_name || user.email?.split('@')[0],
          avatarUrl: profile?.avatar_url,
        });
      }
    };
    
    fetchProfile();
  }, [isLoggedIn]);

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // Update when URL param changes
  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam && urlParam !== activeTab?.url) {
      handleNavigate(urlParam);
    }
  }, [searchParams]);

  // Load initial URL with proxy if needed
  useEffect(() => {
    if (needsProxy(initialUrl)) {
      loadWithProxy(initialUrl);
    }
  }, []);

  // Listen for navigation messages from proxied content
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'navigate' && event.data?.url) {
        handleNavigate(event.data.url);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeTabId, tabs]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Help overlay shortcuts (? or F1)
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        setShowShortcutsHelp(true);
        return;
      }

      // Check for Ctrl (or Cmd on Mac) modifier
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Shift+N for new incognito tab
        if (e.shiftKey && e.key.toLowerCase() === 'n') {
          e.preventDefault();
          addNewTab(true);
          return;
        }

        // Ctrl+Shift+T to reopen last closed tab
        if (e.shiftKey && e.key.toLowerCase() === 't') {
          e.preventDefault();
          reopenClosedTab();
          return;
        }

        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault();
            if (activeTab?.url) {
              setShowBookmarks(true);
              toast.success("Add this page to bookmarks");
            }
            break;
          case 'b':
            e.preventDefault();
            setShowBookmarks(true);
            break;
          case 'h':
            e.preventDefault();
            navigate('/history');
            break;
          case 't':
            e.preventDefault();
            addNewTab();
            break;
          case 'l':
            e.preventDefault();
            const addressInput = document.querySelector('input[data-address-bar="true"]') as HTMLInputElement;
            if (addressInput) {
              addressInput.focus();
              addressInput.select();
            }
            break;
          case 'r':
            e.preventDefault();
            if (activeTab?.url) {
              handleNavigate(activeTab.url);
            }
            break;
          case 'w':
            e.preventDefault();
            if (tabs.length > 1) {
              closeTab(activeTabId);
            } else {
              toast.info("Cannot close the last tab");
            }
            break;
          case 'tab':
            e.preventDefault();
            if (tabs.length > 1) {
              const currentIndex = tabs.findIndex(t => t.id === activeTabId);
              const nextIndex = e.shiftKey 
                ? (currentIndex - 1 + tabs.length) % tabs.length
                : (currentIndex + 1) % tabs.length;
              setActiveTabId(tabs[nextIndex].id);
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, navigate]);

  function getHostname(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "New Tab";
    }
  }

  function getFaviconUrl(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    } catch {
      return "";
    }
  }

  const loadWithProxy = async (url: string) => {
    setIsLoading(true);
    setProxyError(null);
    setProxyContent(null);
    setUseProxy(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('web-proxy', {
        body: { url }
      });
      
      if (error) {
        console.error('Proxy error:', error);
        setProxyError(`Failed to load: ${error.message}`);
        setUseProxy(false);
      } else if (typeof data === 'string') {
        setProxyContent(data);
      } else if (data?.error) {
        setProxyError(data.error);
        setUseProxy(false);
      } else {
        setProxyContent(data);
      }
    } catch (err) {
      console.error('Proxy fetch error:', err);
      setProxyError('Failed to load page through proxy');
      setUseProxy(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = async (url: string) => {
    let processedUrl = url.trim();
    
    if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      if (processedUrl.includes('.')) {
        processedUrl = 'https://' + processedUrl;
      } else {
        navigate(`/search?q=${encodeURIComponent(processedUrl)}`);
        return;
      }
    }

    setTabs(tabs.map(tab => {
      if (tab.id === activeTabId) {
        const newHistory = tab.historyIndex >= 0 
          ? [...tab.history.slice(0, tab.historyIndex + 1), processedUrl]
          : [processedUrl];
        return { 
          ...tab, 
          url: processedUrl, 
          title: getHostname(processedUrl),
          history: newHistory,
          historyIndex: newHistory.length - 1,
          favicon: getFaviconUrl(processedUrl),
          isNewTab: false
        };
      }
      return tab;
    }));
    setUrlInput(processedUrl);

    if (needsProxy(processedUrl)) {
      await loadWithProxy(processedUrl);
    } else {
      setUseProxy(false);
      setProxyContent(null);
      setProxyError(null);
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 1500);
    }
  };

  const goBack = () => {
    if (!activeTab || activeTab.historyIndex <= 0) return;
    
    const newIndex = activeTab.historyIndex - 1;
    const newUrl = activeTab.history[newIndex];
    
    setTabs(tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, url: newUrl, title: getHostname(newUrl), historyIndex: newIndex }
        : tab
    ));
    setUrlInput(newUrl);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  const goForward = () => {
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return;
    
    const newIndex = activeTab.historyIndex + 1;
    const newUrl = activeTab.history[newIndex];
    
    setTabs(tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, url: newUrl, title: getHostname(newUrl), historyIndex: newIndex }
        : tab
    ));
    setUrlInput(newUrl);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  const addNewTab = (incognito: boolean = false) => {
    const newTab: Tab = {
      id: Date.now().toString(),
      url: "",
      title: incognito ? "Incognito Tab" : "New Tab",
      history: [],
      historyIndex: -1,
      isNewTab: true,
      incognito
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    setUrlInput("");
    if (incognito) {
      toast.info("Incognito mode: Your browsing won't be saved to history");
    }
  };

  const closeTab = (tabId: string) => {
    const tabToClose = tabs.find(tab => tab.id === tabId);
    if (tabToClose?.pinned) {
      toast.info("Unpin tab first to close it");
      return;
    }
    // Save closed tab for restoration (skip incognito tabs)
    if (tabToClose && !tabToClose.incognito && !tabToClose.isNewTab) {
      setClosedTabs(prev => [...prev, { ...tabToClose, pinned: false }]);
    }
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    if (newTabs.length === 0) {
      addNewTab();
      return;
    }
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
      setUrlInput(newTabs[0].url);
    }
  };

  const reopenClosedTab = () => {
    if (closedTabs.length === 0) {
      toast.info("No closed tabs to restore");
      return;
    }
    const lastClosed = closedTabs[closedTabs.length - 1];
    const restoredTab: Tab = {
      ...lastClosed,
      id: Date.now().toString(), // New ID to avoid conflicts
    };
    setClosedTabs(prev => prev.slice(0, -1));
    setTabs(prev => [...prev, restoredTab]);
    setActiveTabId(restoredTab.id);
    setUrlInput(restoredTab.url);
    toast.success("Tab restored");
  };

  const toggleExtension = (id: string) => {
    setExtensions(prev => prev.map(ext => 
      ext.id === id ? { ...ext, enabled: !ext.enabled } : ext
    ));
    const ext = extensions.find(e => e.id === id);
    toast.success(ext?.enabled ? `${ext?.name} disabled` : `${ext?.name} enabled`);
  };

  const removeExtension = (id: string) => {
    const ext = extensions.find(e => e.id === id);
    setExtensions(prev => prev.filter(e => e.id !== id));
    toast.success(`${ext?.name} removed`);
  };

  const installExtension = (ext: Extension) => {
    setExtensions(prev => [...prev, ext]);
    toast.success(`${ext.name} installed`);
  };

  const togglePinTab = (tabId: string) => {
    setTabs(prevTabs => {
      const updatedTabs = prevTabs.map(tab =>
        tab.id === tabId ? { ...tab, pinned: !tab.pinned } : tab
      );
      // Sort: pinned tabs first
      return updatedTabs.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0;
      });
    });
    const tab = tabs.find(t => t.id === tabId);
    toast.success(tab?.pinned ? "Tab unpinned" : "Tab pinned");
  };

  const openInNewWindow = () => {
    if (activeTab) {
      window.open(activeTab.url, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    const tab = tabs.find(tab => tab.id === activeTabId);
    if (tab) {
      setUrlInput(tab.url);
    }
  }, [activeTabId, tabs]);

  const canGoBack = activeTab && activeTab.historyIndex > 0;
  const canGoForward = activeTab && activeTab.historyIndex < activeTab.history.length - 1;

  const isSecure = activeTab?.url.startsWith('https://');

  const [showSyncPrompt, setShowSyncPrompt] = useState(true);

  return (
    <div className="h-screen flex flex-col bg-[#202124] text-white">
      {/* Sign in to sync prompt for unauthenticated users */}
      {!isLoggedIn && showSyncPrompt && !activeTab?.incognito && (
        <div className="bg-gradient-to-r from-blue-600/90 to-indigo-600/90 px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-medium">Sign in to sync your browser</span>
              <span className="text-blue-200 ml-2">Keep your tabs, extensions, and settings across devices</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button 
                size="sm" 
                className="bg-white text-blue-600 hover:bg-blue-50 font-medium rounded-full px-4"
              >
                Sign in
              </Button>
            </Link>
            <button 
              onClick={() => setShowSyncPrompt(false)}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab Bar - Chrome/Yandex style */}
      <div className={`flex items-end pt-2 pl-2 pr-2 ${activeTab?.incognito ? 'bg-[#3d2d5c]' : 'bg-[#35363a]'}`}>
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none">
          {tabs.map(tab => (
            <DropdownMenu key={tab.id}>
              <DropdownMenuTrigger asChild>
                <div
                  className={`group relative flex items-center cursor-pointer transition-all rounded-t-lg ${
                    tab.pinned 
                      ? 'w-10 h-9 justify-center px-0 py-2' 
                      : 'gap-2 pl-3 pr-2 py-2 min-w-[140px] max-w-[240px]'
                  } ${
                    activeTabId === tab.id 
                      ? tab.incognito 
                        ? 'bg-[#2a1f3d] text-purple-200' 
                        : 'bg-[#202124] text-white' 
                      : tab.incognito
                        ? 'bg-[#3d2d5c] hover:bg-[#4d3d6c] text-purple-300'
                        : 'bg-[#2d2e31] hover:bg-[#3c3d41] text-gray-400'
                  }`}
                  onClick={(e) => {
                    // Only switch tabs on left click without context menu
                    if (e.type === 'click') {
                      setActiveTabId(tab.id);
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {/* Pin indicator for pinned tabs */}
                  {tab.pinned && (
                    <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${tab.incognito ? 'bg-purple-500' : 'bg-blue-500'}`} />
                  )}
                  
                  {/* Incognito indicator */}
                  {tab.incognito && !tab.pinned && (
                    <EyeOff className="w-3 h-3 text-purple-400 absolute -top-1 -left-1" />
                  )}
                  
                  {/* Favicon */}
                  <div className="w-4 h-4 flex-shrink-0">
                    {isLoading && activeTabId === tab.id ? (
                      <Loader2 className={`w-4 h-4 animate-spin ${tab.incognito ? 'text-purple-400' : 'text-blue-400'}`} />
                    ) : tab.isNewTab ? (
                      tab.incognito ? (
                        <EyeOff className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Plus className="w-4 h-4 text-gray-400" />
                      )
                    ) : (
                      <img 
                        src={getFaviconUrl(tab.url)} 
                        alt="" 
                        className="w-4 h-4"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                  
                  {/* Title - only show for non-pinned tabs */}
                  {!tab.pinned && (
                    <span className="text-xs truncate flex-1 font-medium">{tab.title}</span>
                  )}
                  
                  {/* Close button - only show for non-pinned tabs */}
                  {!tab.pinned && (
                    <button
                      className="w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}

                  {/* Tab separator */}
                  {activeTabId !== tab.id && !tab.pinned && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-gray-600" />
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#2d2e31] border-gray-600 text-white">
                <DropdownMenuItem 
                  className="hover:bg-white/10 cursor-pointer"
                  onClick={() => togglePinTab(tab.id)}
                >
                  <Pin className="w-4 h-4 mr-2" />
                  {tab.pinned ? 'Unpin tab' : 'Pin tab'}
                </DropdownMenuItem>
                {!tab.pinned && (
                  <>
                    <DropdownMenuSeparator className="bg-gray-600" />
                    <DropdownMenuItem 
                      className="hover:bg-white/10 cursor-pointer text-red-400"
                      onClick={() => closeTab(tab.id)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Close tab
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
          
          {/* New Tab Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="w-7 h-7 ml-1 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                onClick={() => addNewTab(false)}
              >
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
            </TooltipTrigger>
            <TooltipContent>New tab (Ctrl+T)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Navigation Bar - Corporate style */}
      <div className={`px-2 py-1.5 flex items-center gap-1 ${activeTab?.incognito ? 'bg-[#2a1f3d]' : 'bg-[#202124]'}`}>
        {/* Navigation buttons */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  canGoBack ? 'hover:bg-white/10 text-gray-300' : 'text-gray-600 cursor-not-allowed'
                }`}
                disabled={!canGoBack}
                onClick={goBack}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Back (Alt+←)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  canGoForward ? 'hover:bg-white/10 text-gray-300' : 'text-gray-600 cursor-not-allowed'
                }`}
                disabled={!canGoForward}
                onClick={goForward}
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Forward (Alt+→)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-gray-300 transition-colors"
                onClick={() => handleNavigate(activeTab?.url || "")}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Reload (Ctrl+R)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link to="/">
                <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-gray-300 transition-colors">
                  <Home className="w-4 h-4" />
                </button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Home</TooltipContent>
          </Tooltip>
        </div>

        {/* URL Bar - Enhanced with autocomplete */}
        <div className="flex-1 mx-2">
          <BrowserSearchBar
            value={urlInput}
            onChange={setUrlInput}
            onNavigate={handleNavigate}
            onSearch={(query) => navigate(`/search?q=${encodeURIComponent(query)}`)}
            placeholder={activeTab?.incognito ? "Incognito - Search or enter address" : "Search or enter address"}
            isIncognito={activeTab?.incognito}
          />
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to="/search">
                <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                  <Search className="w-4 h-4 text-gray-300" />
                </button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Search</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                onClick={() => setShowBookmarks(true)}
              >
                <Bookmark className="w-4 h-4 text-gray-300" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Bookmarks (Ctrl+B)</TooltipContent>
          </Tooltip>

          {/* Recently Closed Dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button 
                    className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors ${
                      closedTabs.length === 0 ? 'opacity-50' : ''
                    }`}
                  >
                    <RotateCcw className="w-4 h-4 text-gray-300" />
                    {closedTabs.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full text-[9px] flex items-center justify-center font-medium">
                        {closedTabs.length > 9 ? '9+' : closedTabs.length}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Recently Closed (Ctrl+Shift+T)</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="bg-[#2d2e31] border-gray-600 text-white w-72 max-h-80 overflow-y-auto">
              <div className="px-3 py-2 text-xs text-gray-400 font-medium border-b border-gray-600">
                Recently Closed Tabs
              </div>
              {closedTabs.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  No recently closed tabs
                </div>
              ) : (
                <>
                  {[...closedTabs].reverse().map((tab, index) => (
                    <DropdownMenuItem
                      key={`${tab.id}-${index}`}
                      className="hover:bg-white/10 cursor-pointer px-3 py-2"
                      onClick={() => {
                        const restoredTab: Tab = {
                          ...tab,
                          id: Date.now().toString(),
                        };
                        setClosedTabs(prev => prev.filter((_, i) => i !== closedTabs.length - 1 - index));
                        setTabs(prev => [...prev, restoredTab]);
                        setActiveTabId(restoredTab.id);
                        setUrlInput(restoredTab.url);
                        toast.success("Tab restored");
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <img 
                          src={getFaviconUrl(tab.url)} 
                          alt="" 
                          className="w-4 h-4 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{tab.title}</div>
                          <div className="text-xs text-gray-500 truncate">{tab.url}</div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="bg-gray-600" />
                  <DropdownMenuItem
                    className="hover:bg-white/10 cursor-pointer px-3 py-2 text-blue-400"
                    onClick={() => {
                      // Restore all tabs
                      closedTabs.forEach((tab, i) => {
                        setTimeout(() => {
                          const restoredTab: Tab = {
                            ...tab,
                            id: Date.now().toString() + i,
                          };
                          setTabs(prev => [...prev, restoredTab]);
                        }, i * 50);
                      });
                      setClosedTabs([]);
                      toast.success(`Restored ${closedTabs.length} tabs`);
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restore all ({closedTabs.length} tabs)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="hover:bg-white/10 cursor-pointer px-3 py-2 text-red-400"
                    onClick={() => {
                      setClosedTabs([]);
                      toast.success("Cleared recently closed tabs");
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Clear all
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors relative"
                onClick={() => setShowDownloads(true)}
              >
                <Download className="w-4 h-4 text-gray-300" />
                {downloads.filter(d => d.status === 'downloading').length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full text-[8px] flex items-center justify-center">
                    {downloads.filter(d => d.status === 'downloading').length}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>Downloads</TooltipContent>
          </Tooltip>

          {/* Extensions Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors relative"
                onClick={() => setShowExtensions(true)}
              >
                <Puzzle className="w-4 h-4 text-gray-300" />
                {extensions.filter(e => e.enabled).length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full text-[9px] flex items-center justify-center font-medium">
                    {extensions.filter(e => e.enabled).length}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>Extensions</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                onClick={openInNewWindow}
              >
                <ExternalLink className="w-4 h-4 text-gray-300" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Open in new window</TooltipContent>
          </Tooltip>

          {/* Main Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                <MoreVertical className="w-4 h-4 text-gray-300" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#2d2e31] border-gray-700 text-white">
              <DropdownMenuItem className="hover:bg-white/10 cursor-pointer" onClick={() => addNewTab(false)}>
                <Plus className="w-4 h-4 mr-3" />
                New Tab
                <span className="ml-auto text-xs text-gray-500">Ctrl+T</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-white/10 cursor-pointer text-purple-400" onClick={() => addNewTab(true)}>
                <EyeOff className="w-4 h-4 mr-3" />
                New Incognito Tab
                <span className="ml-auto text-xs text-gray-500">Ctrl+Shift+N</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-white/10 cursor-pointer" onClick={openInNewWindow}>
                <ExternalLink className="w-4 h-4 mr-3" />
                Open in New Window
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem className="hover:bg-white/10 cursor-pointer" asChild>
                <Link to="/history">
                  <History className="w-4 h-4 mr-3" />
                  History
                  <span className="ml-auto text-xs text-gray-500">Ctrl+H</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-white/10 cursor-pointer" onClick={() => setShowBookmarks(true)}>
                <Bookmark className="w-4 h-4 mr-3" />
                Bookmarks
                <span className="ml-auto text-xs text-gray-500">Ctrl+B</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem className="hover:bg-white/10 cursor-pointer" asChild>
                <Link to="/settings">
                  <Settings className="w-4 h-4 mr-3" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-white/10 cursor-pointer" onClick={() => setShowShortcutsHelp(true)}>
                <Grid3X3 className="w-4 h-4 mr-3" />
                Keyboard Shortcuts
                <span className="ml-auto text-xs text-gray-500">?</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem className="hover:bg-white/10 cursor-pointer" asChild>
                <Link to="/">
                  <Globe className="w-4 h-4 mr-3" />
                  About Alsamos
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile/User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors ml-1">
                {isLoggedIn && userProfile?.avatarUrl ? (
                  <img 
                    src={userProfile.avatarUrl} 
                    alt="Profile" 
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isLoggedIn 
                      ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                      : 'bg-gradient-to-br from-blue-500 to-purple-600'
                  }`}>
                    <User className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 bg-[#2d2e31] border-gray-700 text-white p-0">
              {isLoggedIn ? (
                <>
                  {/* User Info Header */}
                  <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                      {userProfile?.avatarUrl ? (
                        <img 
                          src={userProfile.avatarUrl} 
                          alt="Profile" 
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {userProfile?.displayName || 'User'}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {userProfile?.email}
                        </div>
                      </div>
                    </div>
                    
                    {/* Sync Status */}
                    <div className="mt-3 flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm text-green-400">Syncing enabled</span>
                      <div className="ml-auto text-xs text-gray-500">
                        {tabs.length} tabs • {extensions.filter(e => e.enabled).length} extensions
                      </div>
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="p-2">
                    <DropdownMenuItem className="hover:bg-white/10 cursor-pointer rounded-lg" asChild>
                      <Link to="/settings" className="flex items-center gap-3 px-2 py-2">
                        <Settings className="w-4 h-4 text-gray-400" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="hover:bg-white/10 cursor-pointer rounded-lg" asChild>
                      <Link to="/history" className="flex items-center gap-3 px-2 py-2">
                        <History className="w-4 h-4 text-gray-400" />
                        <span>History</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="hover:bg-white/10 cursor-pointer rounded-lg" asChild>
                      <Link to="/bookmarks" className="flex items-center gap-3 px-2 py-2">
                        <Bookmark className="w-4 h-4 text-gray-400" />
                        <span>Bookmarks</span>
                      </Link>
                    </DropdownMenuItem>
                  </div>
                  
                  <DropdownMenuSeparator className="bg-gray-700" />
                  
                  {/* Sign Out */}
                  <div className="p-2">
                    <DropdownMenuItem 
                      className="hover:bg-red-500/10 cursor-pointer rounded-lg text-red-400"
                      onClick={async () => {
                        await supabase.auth.signOut();
                        toast.success("Signed out successfully");
                      }}
                    >
                      <div className="flex items-center gap-3 px-2 py-2">
                        <X className="w-4 h-4" />
                        <span>Sign out</span>
                      </div>
                    </DropdownMenuItem>
                  </div>
                </>
              ) : (
                <>
                  {/* Not Signed In */}
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium">Guest User</div>
                        <div className="text-xs text-gray-400">Not signed in</div>
                      </div>
                    </div>
                    
                    {/* Sync Disabled Warning */}
                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                      <span className="text-sm text-yellow-400">Sync disabled</span>
                    </div>
                    
                    <p className="text-xs text-gray-400 mb-3">
                      Sign in to sync your tabs, bookmarks, extensions, and settings across all your devices.
                    </p>
                    
                    <Link to="/auth">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                        Sign in to sync
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Browser Content */}
      <div className="flex-1 bg-white relative overflow-hidden">
        {activeTab && (
          <>
            {/* New Tab Page or Incognito New Tab */}
            {activeTab.isNewTab && !isLoading && (
              activeTab.incognito ? (
                <div className="h-full bg-[#1a1525] flex flex-col items-center justify-center text-center px-6">
                  <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center mb-6">
                    <EyeOff className="w-10 h-10 text-purple-400" />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-3">You've gone incognito</h1>
                  <p className="text-gray-400 max-w-md mb-8">
                    Now you can browse privately. Other people who use this device won't see your activity.
                    However, your employer or internet service provider can still see activity.
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-left max-w-lg">
                    <div className="bg-purple-500/10 rounded-lg p-4">
                      <h3 className="text-purple-300 font-semibold mb-2 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        What incognito does
                      </h3>
                      <ul className="text-gray-400 text-sm space-y-1">
                        <li>• Doesn't save browsing history</li>
                        <li>• Doesn't save cookies after close</li>
                        <li>• Keeps activity private on device</li>
                      </ul>
                    </div>
                    <div className="bg-gray-500/10 rounded-lg p-4">
                      <h3 className="text-gray-300 font-semibold mb-2 flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        What incognito doesn't do
                      </h3>
                      <ul className="text-gray-400 text-sm space-y-1">
                        <li>• Hide activity from websites</li>
                        <li>• Hide activity from employer</li>
                        <li>• Hide your IP address</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-8">
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleNavigate(urlInput);
                        }
                      }}
                      className="w-80 h-12 bg-[#3d2d5c] border-purple-500/30 rounded-full text-white text-center placeholder:text-purple-300/50 focus:ring-2 focus:ring-purple-500/50"
                      placeholder="Search or enter address"
                    />
                  </div>
                </div>
              ) : (
                <NewTabPage 
                  onNavigate={(url) => handleNavigate(url)} 
                />
              )
            )}

            {/* Loading State */}
            {isLoading && (
              <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 ${activeTab.incognito ? 'bg-[#1a1525]' : 'bg-[#202124]'}`}>
                <div className="relative">
                  <div className={`w-12 h-12 rounded-full border-2 ${activeTab.incognito ? 'border-purple-500/20' : 'border-blue-500/20'}`} />
                  <div className={`absolute inset-0 w-12 h-12 rounded-full border-2 border-t-transparent animate-spin ${activeTab.incognito ? 'border-purple-500' : 'border-blue-500'}`} />
                </div>
                <p className="text-gray-400 mt-4 text-sm">Loading {getHostname(activeTab.url)}...</p>
                {activeTab.incognito && (
                  <p className="text-purple-400/60 mt-1 text-xs flex items-center gap-1">
                    <EyeOff className="w-3 h-3" /> Incognito mode
                  </p>
                )}
              </div>
            )}
            
            {/* Error State */}
            {proxyError && !isLoading && !activeTab.isNewTab ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124]">
                <div className="max-w-md text-center px-6">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Globe className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    This site can't be reached
                  </h3>
                  <p className="text-gray-400 text-sm mb-6">
                    {getHostname(activeTab.url)} refused to connect.
                  </p>
                  <p className="text-gray-500 text-xs mb-6">
                    {proxyError}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button 
                      onClick={openInNewWindow} 
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Externally
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleNavigate(activeTab.url)}
                      className="border-gray-600 text-gray-300 hover:bg-white/10 rounded-full px-6"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                </div>
              </div>
            ) : useProxy && proxyContent && !activeTab.isNewTab ? (
              <iframe
                ref={iframeRef}
                srcDoc={proxyContent}
                className="w-full h-full bg-white"
                title={activeTab.title}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-modals"
                allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; payment"
              />
            ) : !isLoading && !activeTab.isNewTab && activeTab.url && (
              <iframe
                key={activeTab.id + activeTab.url}
                src={activeTab.url}
                className="w-full h-full bg-white"
                title={activeTab.title}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-modals"
                allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; payment"
              />
            )}
          </>
        )}
      </div>

      {/* Status Bar - Minimal corporate style */}
      <div className={`border-t px-3 py-1 flex items-center justify-between ${
        activeTab?.incognito 
          ? 'bg-[#2a1f3d] border-[#3d2d5c]' 
          : 'bg-[#202124] border-[#35363a]'
      }`}>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {activeTab?.incognito ? (
            <>
              <div className="flex items-center gap-1.5">
                <EyeOff className="w-3 h-3 text-purple-400" />
                <span className="text-purple-300">Incognito</span>
              </div>
              <span className="text-purple-600">|</span>
              <span className="text-purple-400/60">History disabled</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-green-500" />
                <span>Secure</span>
              </div>
              <span className="text-gray-600">|</span>
              <span>Alsamos Browser</span>
              {isLoggedIn && (
                <>
                  <span className="text-gray-600">|</span>
                  <div className="flex items-center gap-1 text-green-500">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span>Synced</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div className="text-xs text-gray-500 truncate max-w-[60%]">
          {activeTab?.url}
        </div>
      </div>

      {/* Bookmarks Manager */}
      <BookmarksManager 
        isOpen={showBookmarks}
        onClose={() => setShowBookmarks(false)}
        onNavigate={(url) => {
          setShowBookmarks(false);
          handleNavigate(url);
        }}
        currentUrl={activeTab?.url}
        currentTitle={activeTab?.title}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp 
        open={showShortcutsHelp} 
        onOpenChange={setShowShortcutsHelp} 
      />

      {/* Downloads Manager */}
      <DownloadsManager
        isOpen={showDownloads}
        onClose={() => setShowDownloads(false)}
        downloads={downloads}
        onRemove={(id) => setDownloads(downloads.filter(d => d.id !== id))}
        onClearAll={() => setDownloads([])}
      />

      {/* Extensions Manager */}
      <ExtensionsManager
        isOpen={showExtensions}
        onClose={() => setShowExtensions(false)}
        extensions={extensions}
        onToggleExtension={toggleExtension}
        onRemoveExtension={removeExtension}
        onInstallExtension={installExtension}
      />
    </div>
  );
};

export default Browser;
