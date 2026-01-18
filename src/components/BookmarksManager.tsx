import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Star, 
  Folder, 
  Plus, 
  Trash2, 
  Edit2, 
  ExternalLink,
  Tag,
  X,
  Globe,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BookmarkFolder {
  id: string;
  name: string;
  color: string;
  icon: string;
  parent_id: string | null;
  user_id: string;
}

interface Bookmark {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  domain: string | null;
  folder_id: string | null;
  tags: string[];
  favicon_url: string | null;
  created_at: string;
}

interface BookmarksManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (url: string) => void;
  currentUrl?: string;
  currentTitle?: string;
}

export const BookmarksManager = ({ 
  isOpen, 
  onClose, 
  onNavigate,
  currentUrl,
  currentTitle
}: BookmarksManagerProps) => {
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [newTag, setNewTag] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const [foldersRes, bookmarksRes] = await Promise.all([
        supabase.from('bookmark_folders').select('*').order('name'),
        supabase.from('bookmarked_results').select('*').order('created_at', { ascending: false })
      ]);

      if (foldersRes.data) setFolders(foldersRes.data);
      if (bookmarksRes.data) {
        setBookmarks(bookmarksRes.data.map(b => ({
          ...b,
          tags: b.tags || []
        })));
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Please sign in", description: "You need to be signed in to create folders", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase
      .from('bookmark_folders')
      .insert({
        name: newFolderName.trim(),
        user_id: user.id,
        parent_id: selectedFolder
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
      return;
    }

    setFolders([...folders, data]);
    setNewFolderName("");
    setShowNewFolder(false);
    toast({ title: "Folder created", description: `"${data.name}" has been created` });
  };

  const addBookmark = async (url: string, title: string, folderId?: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Please sign in", description: "You need to be signed in to save bookmarks", variant: "destructive" });
      return;
    }

    try {
      const domain = new URL(url).hostname.replace('www.', '');
      const { data, error } = await supabase
        .from('bookmarked_results')
        .insert({
          url,
          title,
          domain,
          folder_id: folderId || null,
          user_id: user.id,
          tags: []
        })
        .select()
        .single();

      if (error) throw error;

      setBookmarks([{ ...data, tags: data.tags || [] }, ...bookmarks]);
      toast({ title: "Bookmark saved", description: `"${title || url}" has been bookmarked` });
    } catch (error) {
      console.error('Error adding bookmark:', error);
      toast({ title: "Error", description: "Failed to save bookmark", variant: "destructive" });
    }
  };

  const updateBookmark = async (bookmark: Bookmark) => {
    const { error } = await supabase
      .from('bookmarked_results')
      .update({
        title: bookmark.title,
        folder_id: bookmark.folder_id,
        tags: bookmark.tags
      })
      .eq('id', bookmark.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update bookmark", variant: "destructive" });
      return;
    }

    setBookmarks(bookmarks.map(b => b.id === bookmark.id ? bookmark : b));
    setEditingBookmark(null);
    toast({ title: "Bookmark updated" });
  };

  const deleteBookmark = async (id: string) => {
    const { error } = await supabase
      .from('bookmarked_results')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete bookmark", variant: "destructive" });
      return;
    }

    setBookmarks(bookmarks.filter(b => b.id !== id));
    toast({ title: "Bookmark deleted" });
  };

  const deleteFolder = async (id: string) => {
    const { error } = await supabase
      .from('bookmark_folders')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete folder", variant: "destructive" });
      return;
    }

    setFolders(folders.filter(f => f.id !== id));
    if (selectedFolder === id) setSelectedFolder(null);
    toast({ title: "Folder deleted" });
  };

  const addTagToBookmark = (bookmark: Bookmark, tag: string) => {
    if (!tag.trim() || bookmark.tags.includes(tag.trim())) return;
    const updatedBookmark = { ...bookmark, tags: [...bookmark.tags, tag.trim()] };
    updateBookmark(updatedBookmark);
  };

  const removeTagFromBookmark = (bookmark: Bookmark, tag: string) => {
    const updatedBookmark = { ...bookmark, tags: bookmark.tags.filter(t => t !== tag) };
    updateBookmark(updatedBookmark);
  };

  const toggleFolderExpand = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const filteredBookmarks = bookmarks.filter(bookmark => {
    const matchesSearch = !searchQuery || 
      bookmark.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFolder = selectedFolder === null || bookmark.folder_id === selectedFolder;
    
    return matchesSearch && matchesFolder;
  });

  const isCurrentUrlBookmarked = currentUrl && bookmarks.some(b => b.url === currentUrl);

  const renderFolderTree = (parentId: string | null = null, depth: number = 0) => {
    const childFolders = folders.filter(f => f.parent_id === parentId);
    
    return childFolders.map(folder => {
      const hasChildren = folders.some(f => f.parent_id === folder.id);
      const isExpanded = expandedFolders.has(folder.id);
      const folderBookmarks = bookmarks.filter(b => b.folder_id === folder.id);
      
      return (
        <div key={folder.id}>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              selectedFolder === folder.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
            }`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={() => setSelectedFolder(folder.id)}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolderExpand(folder.id);
                }}
                className="p-0.5"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            )}
            <Folder className="w-4 h-4" style={{ color: folder.color }} />
            <span className="flex-1 truncate text-sm">{folder.name}</span>
            <span className="text-xs text-muted-foreground">{folderBookmarks.length}</span>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                deleteFolder(folder.id);
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          {hasChildren && isExpanded && renderFolderTree(folder.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Star className="w-5 h-5 text-yellow-500" />
            Bookmarks Manager
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Folders */}
          <div className="w-64 border-r bg-muted/30 flex flex-col">
            <div className="p-3 border-b">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start gap-2"
                onClick={() => setShowNewFolder(true)}
              >
                <Plus className="w-4 h-4" />
                New Folder
              </Button>
            </div>

            {showNewFolder && (
              <div className="p-3 border-b flex gap-2">
                <Input
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createFolder()}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button size="sm" className="h-8" onClick={createFolder}>
                  Add
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8"
                  onClick={() => {
                    setShowNewFolder(false);
                    setNewFolderName("");
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <ScrollArea className="flex-1">
              <div className="p-2">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedFolder === null ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedFolder(null)}
                >
                  <Globe className="w-4 h-4" />
                  <span className="flex-1 text-sm">All Bookmarks</span>
                  <span className="text-xs text-muted-foreground">{bookmarks.length}</span>
                </div>
                
                {renderFolderTree()}
              </div>
            </ScrollArea>
          </div>

          {/* Main Content - Bookmarks */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search & Actions */}
            <div className="p-4 border-b flex items-center gap-3">
              <Input
                placeholder="Search bookmarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              {currentUrl && !isCurrentUrlBookmarked && (
                <Button 
                  onClick={() => addBookmark(currentUrl, currentTitle || currentUrl, selectedFolder)}
                  className="gap-2"
                >
                  <Star className="w-4 h-4" />
                  Bookmark Current Page
                </Button>
              )}
            </div>

            {/* Bookmarks List */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading bookmarks...
                  </div>
                ) : filteredBookmarks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'No bookmarks match your search' : 'No bookmarks yet'}
                  </div>
                ) : (
                  filteredBookmarks.map(bookmark => (
                    <div
                      key={bookmark.id}
                      className="group p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          {bookmark.favicon_url ? (
                            <img 
                              src={bookmark.favicon_url} 
                              alt="" 
                              className="w-5 h-5"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Globe className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 
                              className="font-medium truncate cursor-pointer hover:text-primary"
                              onClick={() => onNavigate?.(bookmark.url)}
                            >
                              {bookmark.title || bookmark.url}
                            </h4>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {bookmark.domain}
                          </p>
                          
                          {/* Tags */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {bookmark.tags.map(tag => (
                              <Badge 
                                key={tag} 
                                variant="secondary" 
                                className="text-xs gap-1 pr-1"
                              >
                                <Tag className="w-3 h-3" />
                                {tag}
                                <button
                                  onClick={() => removeTagFromBookmark(bookmark, tag)}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                            <div className="flex items-center">
                              <Input
                                placeholder="+ tag"
                                className="h-6 w-16 text-xs px-1"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    addTagToBookmark(bookmark, (e.target as HTMLInputElement).value);
                                    (e.target as HTMLInputElement).value = '';
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Select
                            value={bookmark.folder_id || "none"}
                            onValueChange={(value) => {
                              const updated = { 
                                ...bookmark, 
                                folder_id: value === "none" ? null : value 
                              };
                              updateBookmark(updated);
                            }}
                          >
                            <SelectTrigger className="h-8 w-32">
                              <SelectValue placeholder="Move to..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Folder</SelectItem>
                              {folders.map(folder => (
                                <SelectItem key={folder.id} value={folder.id}>
                                  {folder.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(bookmark.url, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteBookmark(bookmark.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
