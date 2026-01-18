import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Extension } from '@/components/browser/ExtensionsManager';
import { DownloadItem } from '@/components/browser/DownloadsManager';

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

// Serializable version of Tab (without React nodes)
interface SerializableTab {
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

// Serializable version of Extension (without React nodes)
interface SerializableExtension {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  permissions: string[];
  size: string;
  enabled: boolean;
}

interface BrowserSessionData {
  tabs: SerializableTab[];
  activeTabId: string;
  extensions: SerializableExtension[];
  extensionSettings: Record<string, Record<string, unknown>>;
  extensionPermissions: Record<string, Record<string, boolean>>;
  downloads: DownloadItem[];
  closedTabs: SerializableTab[];
}

interface UseBrowserSessionOptions {
  defaultTabs: Tab[];
  defaultActiveTabId: string;
  defaultExtensions: Extension[];
  serializeExtension: (ext: Extension) => SerializableExtension;
  deserializeExtension: (ext: SerializableExtension) => Extension;
}

export function useBrowserSession(options: UseBrowserSessionOptions) {
  const {
    defaultTabs,
    defaultActiveTabId,
    defaultExtensions,
    serializeExtension,
    deserializeExtension,
  } = options;

  const [tabs, setTabs] = useState<Tab[]>(defaultTabs);
  const [activeTabId, setActiveTabId] = useState(defaultActiveTabId);
  const [extensions, setExtensions] = useState<Extension[]>(defaultExtensions);
  const [extensionSettings, setExtensionSettings] = useState<Record<string, Record<string, unknown>>>({});
  const [extensionPermissions, setExtensionPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [closedTabs, setClosedTabs] = useState<Tab[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load session from database
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      setIsInitialized(true);
      return;
    }

    const loadSession = async () => {
      try {
        const { data, error } = await supabase
          .from('browser_sessions')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          console.error('Error loading browser session:', error);
          setIsLoading(false);
          setIsInitialized(true);
          return;
        }

        if (data) {
          // Restore tabs (filter out incognito tabs for privacy)
          const savedTabs = (data.tabs as unknown as SerializableTab[]) || [];
          const restoredTabs = savedTabs.filter(t => !t.incognito);
          if (restoredTabs.length > 0) {
            setTabs(restoredTabs);
            setActiveTabId(data.active_tab_id || restoredTabs[0].id);
          }

          // Restore extensions
          const savedExtensions = (data.extensions as unknown as SerializableExtension[]) || [];
          if (savedExtensions.length > 0) {
            setExtensions(savedExtensions.map(deserializeExtension));
          }

          // Restore extension settings and permissions
          setExtensionSettings((data.extension_settings as Record<string, Record<string, unknown>>) || {});
          setExtensionPermissions((data.extension_permissions as Record<string, Record<string, boolean>>) || {});

          // Restore downloads (filter completed ones older than 24h)
          const savedDownloads = (data.downloads as unknown as DownloadItem[]) || [];
          const recentDownloads = savedDownloads.filter(d => {
            if (d.status === 'completed') {
              const downloadDate = new Date(d.startedAt).getTime();
              const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
              return downloadDate > dayAgo;
            }
            return d.status !== 'downloading'; // Don't restore active downloads
          });
          setDownloads(recentDownloads);

          // Restore closed tabs (max 10)
          const savedClosedTabs = (data.closed_tabs as unknown as SerializableTab[]) || [];
          setClosedTabs(savedClosedTabs.slice(-10));

          toast.success('Session restored');
        }
      } catch (err) {
        console.error('Failed to load session:', err);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    loadSession();
  }, [userId, deserializeExtension]);

  // Save session to database (debounced)
  const saveSession = useCallback(async () => {
    if (!userId || !isInitialized) return;

    // Serialize tabs (filter incognito for privacy)
    const serializableTabs: SerializableTab[] = tabs
      .filter(t => !t.incognito)
      .map(({ id, url, title, history, historyIndex, favicon, isNewTab, pinned }) => ({
        id, url, title, history, historyIndex, favicon, isNewTab, pinned
      }));

    // Serialize extensions
    const serializableExtensions = extensions.map(serializeExtension);

    // Serialize closed tabs (max 10, no incognito)
    const serializableClosedTabs: SerializableTab[] = closedTabs
      .filter(t => !t.incognito)
      .slice(-10)
      .map(({ id, url, title, history, historyIndex, favicon, isNewTab, pinned }) => ({
        id, url, title, history, historyIndex, favicon, isNewTab, pinned
      }));

    const sessionData = {
      user_id: userId,
      tabs: serializableTabs as unknown as Record<string, unknown>[],
      active_tab_id: activeTabId,
      extensions: serializableExtensions as unknown as Record<string, unknown>[],
      extension_settings: extensionSettings as unknown as Record<string, unknown>,
      extension_permissions: extensionPermissions as unknown as Record<string, unknown>,
      downloads: downloads as unknown as Record<string, unknown>[],
      closed_tabs: serializableClosedTabs as unknown as Record<string, unknown>[],
      updated_at: new Date().toISOString(),
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase
        .from('browser_sessions') as any)
        .upsert(sessionData, { onConflict: 'user_id' });

      if (error) {
        console.error('Error saving browser session:', error);
      }
    } catch (err) {
      console.error('Failed to save session:', err);
    }
  }, [userId, isInitialized, tabs, activeTabId, extensions, extensionSettings, extensionPermissions, downloads, closedTabs]);

  // Debounced auto-save
  useEffect(() => {
    if (!isInitialized) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSession();
    }, 1000); // Save 1 second after last change

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [tabs, activeTabId, extensions, extensionSettings, extensionPermissions, downloads, closedTabs, saveSession, isInitialized]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (userId && isInitialized) {
        // Use sendBeacon for reliable save on unload
        const serializableTabs: SerializableTab[] = tabs
          .filter(t => !t.incognito)
          .map(({ id, url, title, history, historyIndex, favicon, isNewTab, pinned }) => ({
            id, url, title, history, historyIndex, favicon, isNewTab, pinned
          }));

        const serializableExtensions = extensions.map(ext => ({
          id: ext.id,
          name: ext.name,
          description: ext.description,
          version: ext.version,
          author: ext.author,
          category: ext.category,
          permissions: ext.permissions,
          size: ext.size,
          enabled: ext.enabled,
        }));

        const serializableClosedTabs: SerializableTab[] = closedTabs
          .filter(t => !t.incognito)
          .slice(-10)
          .map(({ id, url, title, history, historyIndex, favicon, isNewTab, pinned }) => ({
            id, url, title, history, historyIndex, favicon, isNewTab, pinned
          }));

        // Note: We can't use async/await here, so we trigger the save
        // The debounced save should have already saved recent changes
        saveSession();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [userId, isInitialized, tabs, extensions, closedTabs, saveSession]);

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    extensions,
    setExtensions,
    extensionSettings,
    setExtensionSettings,
    extensionPermissions,
    setExtensionPermissions,
    downloads,
    setDownloads,
    closedTabs,
    setClosedTabs,
    isLoading,
    isLoggedIn: !!userId,
  };
}
