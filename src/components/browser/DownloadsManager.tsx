import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  File,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  X,
  Pause,
  Play,
  FolderOpen,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock
} from "lucide-react";

export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  size: number;
  downloaded: number;
  status: 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  speed?: number;
}

interface DownloadsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  downloads: DownloadItem[];
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRemove?: (id: string) => void;
  onClearAll?: () => void;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return <Image className="w-5 h-5 text-green-400" />;
  }
  if (['mp4', 'avi', 'mkv', 'mov', 'webm'].includes(ext)) {
    return <Video className="w-5 h-5 text-purple-400" />;
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
    return <Music className="w-5 h-5 text-pink-400" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive className="w-5 h-5 text-yellow-400" />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'].includes(ext)) {
    return <FileText className="w-5 h-5 text-blue-400" />;
  }
  return <File className="w-5 h-5 text-gray-400" />;
};

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatSpeed = (bytesPerSecond: number): string => {
  return formatSize(bytesPerSecond) + '/s';
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const DownloadsManager = ({
  isOpen,
  onClose,
  downloads,
  onPause,
  onResume,
  onCancel,
  onRemove,
  onClearAll
}: DownloadsManagerProps) => {
  const activeDownloads = downloads.filter(d => d.status === 'downloading' || d.status === 'paused');
  const completedDownloads = downloads.filter(d => d.status === 'completed');
  const failedDownloads = downloads.filter(d => d.status === 'failed' || d.status === 'cancelled');

  const renderDownloadItem = (item: DownloadItem) => {
    const progress = item.size > 0 ? (item.downloaded / item.size) * 100 : 0;
    
    return (
      <div
        key={item.id}
        className="flex items-start gap-3 p-3 rounded-lg bg-[#2d2e31] hover:bg-[#35363a] transition-colors"
      >
        {/* File Icon */}
        <div className="w-10 h-10 rounded-lg bg-[#35363a] flex items-center justify-center flex-shrink-0">
          {getFileIcon(item.filename)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm text-white font-medium truncate">{item.filename}</p>
            {item.status === 'completed' && (
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            )}
            {item.status === 'failed' && (
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
          </div>

          {/* Progress bar for active downloads */}
          {(item.status === 'downloading' || item.status === 'paused') && (
            <>
              <Progress value={progress} className="h-1.5 mb-2 bg-[#35363a]" />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {formatSize(item.downloaded)} / {formatSize(item.size)}
                  {item.speed && item.status === 'downloading' && (
                    <span className="ml-2 text-blue-400">{formatSpeed(item.speed)}</span>
                  )}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
            </>
          )}

          {/* Info for completed/failed */}
          {item.status === 'completed' && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{formatSize(item.size)}</span>
              <span>•</span>
              <span>{formatTime(item.completedAt || item.startedAt)}</span>
            </div>
          )}

          {item.status === 'failed' && (
            <p className="text-xs text-red-400">Download failed</p>
          )}

          {item.status === 'cancelled' && (
            <p className="text-xs text-gray-500">Cancelled</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {item.status === 'downloading' && onPause && (
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hover:bg-white/10"
              onClick={() => onPause(item.id)}
            >
              <Pause className="w-4 h-4 text-gray-400" />
            </Button>
          )}
          {item.status === 'paused' && onResume && (
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hover:bg-white/10"
              onClick={() => onResume(item.id)}
            >
              <Play className="w-4 h-4 text-gray-400" />
            </Button>
          )}
          {(item.status === 'downloading' || item.status === 'paused') && onCancel && (
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hover:bg-white/10"
              onClick={() => onCancel(item.id)}
            >
              <X className="w-4 h-4 text-gray-400" />
            </Button>
          )}
          {(item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') && onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hover:bg-white/10"
              onClick={() => onRemove(item.id)}
            >
              <Trash2 className="w-4 h-4 text-gray-400" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className="w-[400px] sm:w-[450px] bg-[#202124] border-l border-[#35363a] text-white p-0"
      >
        <SheetHeader className="px-4 py-3 border-b border-[#35363a]">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-white flex items-center gap-2">
              <Download className="w-5 h-5" />
              Downloads
            </SheetTitle>
            {downloads.length > 0 && onClearAll && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white hover:bg-white/10"
                onClick={onClearAll}
              >
                Clear all
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {downloads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#35363a] flex items-center justify-center mb-4">
                <Download className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-300 mb-2">No downloads yet</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                Files you download will appear here for easy access
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Downloads */}
              {activeDownloads.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    In Progress ({activeDownloads.length})
                  </h3>
                  <div className="space-y-2">
                    {activeDownloads.map(renderDownloadItem)}
                  </div>
                </div>
              )}

              {/* Completed Downloads */}
              {completedDownloads.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed ({completedDownloads.length})
                  </h3>
                  <div className="space-y-2">
                    {completedDownloads.map(renderDownloadItem)}
                  </div>
                </div>
              )}

              {/* Failed Downloads */}
              {failedDownloads.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Failed ({failedDownloads.length})
                  </h3>
                  <div className="space-y-2">
                    {failedDownloads.map(renderDownloadItem)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
