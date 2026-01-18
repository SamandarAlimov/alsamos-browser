import { useState } from "react";
import { 
  Puzzle, 
  Power, 
  Settings, 
  Trash2, 
  Download, 
  Search,
  Shield,
  Zap,
  Eye,
  Moon,
  Lock,
  Globe,
  X,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  ArrowLeft,
  Sliders,
  Palette,
  Bell,
  FileText,
  RefreshCw,
  Key,
  AlertTriangle,
  CheckCircle,
  XCircle,
  History,
  Clipboard,
  Mic,
  Camera,
  MapPin,
  Cookie,
  Database,
  Wifi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Extension {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  version: string;
  author: string;
  category: "security" | "productivity" | "privacy" | "appearance" | "utilities";
  permissions: string[];
  size: string;
}

interface ExtensionSettings {
  [key: string]: {
    [setting: string]: string | boolean | number;
  };
}

interface ExtensionsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  extensions: Extension[];
  onToggleExtension: (id: string) => void;
  onRemoveExtension: (id: string) => void;
  onInstallExtension: (ext: Extension) => void;
}

// Available extensions in the "store"
const availableExtensions: Omit<Extension, "enabled">[] = [
  {
    id: "dark-reader",
    name: "Dark Reader",
    description: "Dark mode for every website. Take care of your eyes, use dark theme for night and daily browsing.",
    icon: <Moon className="w-6 h-6 text-yellow-400" />,
    version: "4.9.80",
    author: "Dark Reader Ltd",
    category: "appearance",
    permissions: ["Read and change all your data on all websites"],
    size: "1.2 MB"
  },
  {
    id: "ublock-origin",
    name: "uBlock Origin",
    description: "An efficient wide-spectrum content blocker. Easy on CPU and memory.",
    icon: <Shield className="w-6 h-6 text-red-400" />,
    version: "1.56.0",
    author: "Raymond Hill",
    category: "security",
    permissions: ["Block content on any page", "Access browsing history"],
    size: "4.8 MB"
  },
  {
    id: "privacy-badger",
    name: "Privacy Badger",
    description: "Privacy Badger automatically learns to block invisible trackers.",
    icon: <Eye className="w-6 h-6 text-orange-400" />,
    version: "2024.2.6",
    author: "EFF",
    category: "privacy",
    permissions: ["Read and change all your data on all websites"],
    size: "2.1 MB"
  },
  {
    id: "bitwarden",
    name: "Bitwarden",
    description: "A secure and free password manager for all of your devices.",
    icon: <Lock className="w-6 h-6 text-blue-400" />,
    version: "2024.2.1",
    author: "Bitwarden Inc",
    category: "security",
    permissions: ["Access login forms", "Store passwords securely"],
    size: "3.4 MB"
  },
  {
    id: "grammarly",
    name: "Grammarly",
    description: "Write confidently with Grammarly's AI-powered writing assistant.",
    icon: <Zap className="w-6 h-6 text-green-400" />,
    version: "14.1120.0",
    author: "Grammarly Inc",
    category: "productivity",
    permissions: ["Read and change text on websites"],
    size: "8.2 MB"
  },
  {
    id: "translate",
    name: "Google Translate",
    description: "View translations easily as you browse the web.",
    icon: <Globe className="w-6 h-6 text-blue-500" />,
    version: "2.0.13",
    author: "Google LLC",
    category: "utilities",
    permissions: ["Read page content for translation"],
    size: "0.5 MB"
  }
];

const categoryColors: Record<Extension["category"], string> = {
  security: "bg-red-500/20 text-red-400",
  productivity: "bg-green-500/20 text-green-400",
  privacy: "bg-orange-500/20 text-orange-400",
  appearance: "bg-purple-500/20 text-purple-400",
  utilities: "bg-blue-500/20 text-blue-400"
};

// Detailed permission definitions
interface Permission {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  riskLevel: "low" | "medium" | "high";
  required: boolean;
}

const allPermissions: Permission[] = [
  {
    id: "read_all_sites",
    name: "Read all website data",
    description: "Can read content on all websites you visit",
    icon: <Globe className="w-4 h-4" />,
    riskLevel: "high",
    required: false
  },
  {
    id: "modify_all_sites",
    name: "Modify all website data",
    description: "Can change content on all websites you visit",
    icon: <FileText className="w-4 h-4" />,
    riskLevel: "high",
    required: false
  },
  {
    id: "browsing_history",
    name: "Browsing history",
    description: "Can access your browsing history",
    icon: <History className="w-4 h-4" />,
    riskLevel: "medium",
    required: false
  },
  {
    id: "clipboard",
    name: "Clipboard access",
    description: "Can read and write to your clipboard",
    icon: <Clipboard className="w-4 h-4" />,
    riskLevel: "medium",
    required: false
  },
  {
    id: "notifications",
    name: "Notifications",
    description: "Can show desktop notifications",
    icon: <Bell className="w-4 h-4" />,
    riskLevel: "low",
    required: false
  },
  {
    id: "storage",
    name: "Local storage",
    description: "Can store data locally on your device",
    icon: <Database className="w-4 h-4" />,
    riskLevel: "low",
    required: false
  },
  {
    id: "cookies",
    name: "Cookies",
    description: "Can access and modify cookies",
    icon: <Cookie className="w-4 h-4" />,
    riskLevel: "medium",
    required: false
  },
  {
    id: "geolocation",
    name: "Location",
    description: "Can access your geographical location",
    icon: <MapPin className="w-4 h-4" />,
    riskLevel: "high",
    required: false
  },
  {
    id: "microphone",
    name: "Microphone",
    description: "Can access your microphone",
    icon: <Mic className="w-4 h-4" />,
    riskLevel: "high",
    required: false
  },
  {
    id: "camera",
    name: "Camera",
    description: "Can access your camera",
    icon: <Camera className="w-4 h-4" />,
    riskLevel: "high",
    required: false
  },
  {
    id: "network_requests",
    name: "Network requests",
    description: "Can make network requests to external servers",
    icon: <Wifi className="w-4 h-4" />,
    riskLevel: "medium",
    required: false
  }
];

// Extension-specific permissions
const extensionPermissions: { [extId: string]: string[] } = {
  "dark-reader": ["read_all_sites", "modify_all_sites", "storage"],
  "ublock-origin": ["read_all_sites", "modify_all_sites", "browsing_history", "storage", "network_requests"],
  "privacy-badger": ["read_all_sites", "browsing_history", "storage", "cookies"],
  "bitwarden": ["read_all_sites", "clipboard", "storage", "notifications"],
  "grammarly": ["read_all_sites", "modify_all_sites", "clipboard", "storage", "network_requests"],
  "translate": ["read_all_sites", "storage", "network_requests"]
};

// Required permissions per extension (cannot be disabled)
const requiredPermissions: { [extId: string]: string[] } = {
  "dark-reader": ["read_all_sites", "modify_all_sites"],
  "ublock-origin": ["read_all_sites", "modify_all_sites"],
  "privacy-badger": ["read_all_sites"],
  "bitwarden": ["read_all_sites", "storage"],
  "grammarly": ["read_all_sites", "modify_all_sites"],
  "translate": ["read_all_sites", "network_requests"]
};

interface ExtensionPermissionState {
  [extId: string]: {
    [permId: string]: boolean;
  };
}

// Default settings for each extension type
const defaultExtensionSettings: ExtensionSettings = {
  "dark-reader": {
    brightness: 100,
    contrast: 100,
    sepia: 0,
    grayscale: 0,
    darkScheme: "dynamic",
    siteList: "whitelist",
    autoDetect: true,
    useSystemTheme: false
  },
  "ublock-origin": {
    blockAds: true,
    blockTrackers: true,
    blockMalware: true,
    cosmetic: true,
    cloudStorage: false,
    advancedMode: false,
    popupBlocking: true,
    logLevel: "default"
  },
  "privacy-badger": {
    learningMode: true,
    showCount: true,
    checkDNT: true,
    preventTracking: true,
    socialWidgets: true,
    webrtcPolicy: "default"
  },
  "bitwarden": {
    autoFill: true,
    autoSave: true,
    lockTimeout: 15,
    clearClipboard: 30,
    masterPasswordReprompt: true,
    showIcons: true,
    notifications: true,
    theme: "system"
  },
  "grammarly": {
    writingStyle: "general",
    dialect: "american",
    showAssistant: true,
    plagiarism: false,
    synonyms: true,
    toneDetection: true,
    weeklyReport: true
  },
  "translate": {
    targetLanguage: "en",
    autoTranslate: false,
    showOriginal: true,
    popupTranslate: true,
    speakTranslation: false,
    highlightText: true
  }
};

// Initialize default permission states
const getDefaultPermissionState = (): ExtensionPermissionState => {
  const state: ExtensionPermissionState = {};
  Object.keys(extensionPermissions).forEach(extId => {
    state[extId] = {};
    extensionPermissions[extId].forEach(permId => {
      state[extId][permId] = true; // All permissions enabled by default
    });
  });
  return state;
};

const riskColors = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-red-400"
};

const riskBgColors = {
  low: "bg-green-500/10",
  medium: "bg-yellow-500/10",
  high: "bg-red-500/10"
};

// Extension Settings Panel Component
const ExtensionSettingsPanel = ({
  extension,
  settings,
  onSettingChange,
  permissions,
  onPermissionChange,
  onClose
}: {
  extension: Extension;
  settings: { [key: string]: string | boolean | number };
  onSettingChange: (key: string, value: string | boolean | number) => void;
  permissions: { [permId: string]: boolean };
  onPermissionChange: (permId: string, enabled: boolean) => void;
  onClose: () => void;
}) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState<"settings" | "permissions">("settings");

  const extPermissionIds = extensionPermissions[extension.id] || [];
  const requiredPerms = requiredPermissions[extension.id] || [];
  const extPermissions = allPermissions.filter(p => extPermissionIds.includes(p.id));

  const enabledPermCount = extPermissionIds.filter(id => permissions[id] !== false).length;
  const highRiskCount = extPermissions.filter(p => p.riskLevel === "high" && permissions[p.id] !== false).length;

  const renderSettings = () => {
    switch (extension.id) {
      case "dark-reader":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Palette className="w-4 h-4" /> Appearance
              </h4>
              <div className="space-y-4 pl-2">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-gray-400">Brightness</Label>
                    <span className="text-sm text-gray-500">{settings.brightness}%</span>
                  </div>
                  <Slider
                    value={[settings.brightness as number]}
                    onValueChange={([v]) => onSettingChange("brightness", v)}
                    min={50}
                    max={150}
                    step={5}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-gray-400">Contrast</Label>
                    <span className="text-sm text-gray-500">{settings.contrast}%</span>
                  </div>
                  <Slider
                    value={[settings.contrast as number]}
                    onValueChange={([v]) => onSettingChange("contrast", v)}
                    min={50}
                    max={150}
                    step={5}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-gray-400">Sepia</Label>
                    <span className="text-sm text-gray-500">{settings.sepia}%</span>
                  </div>
                  <Slider
                    value={[settings.sepia as number]}
                    onValueChange={([v]) => onSettingChange("sepia", v)}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Sliders className="w-4 h-4" /> Behavior
              </h4>
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Use system theme</Label>
                  <Switch
                    checked={settings.useSystemTheme as boolean}
                    onCheckedChange={(v) => onSettingChange("useSystemTheme", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Auto-detect dark pages</Label>
                  <Switch
                    checked={settings.autoDetect as boolean}
                    onCheckedChange={(v) => onSettingChange("autoDetect", v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-gray-400">Dark theme mode</Label>
                  <Select
                    value={settings.darkScheme as string}
                    onValueChange={(v) => onSettingChange("darkScheme", v)}
                  >
                    <SelectTrigger className="bg-[#35363a] border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#35363a] border-gray-600">
                      <SelectItem value="dynamic">Dynamic</SelectItem>
                      <SelectItem value="filter">Filter</SelectItem>
                      <SelectItem value="filter+">Filter+</SelectItem>
                      <SelectItem value="static">Static</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );

      case "ublock-origin":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Blocking
              </h4>
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Block ads</Label>
                  <Switch
                    checked={settings.blockAds as boolean}
                    onCheckedChange={(v) => onSettingChange("blockAds", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Block trackers</Label>
                  <Switch
                    checked={settings.blockTrackers as boolean}
                    onCheckedChange={(v) => onSettingChange("blockTrackers", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Block malware domains</Label>
                  <Switch
                    checked={settings.blockMalware as boolean}
                    onCheckedChange={(v) => onSettingChange("blockMalware", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Cosmetic filtering</Label>
                  <Switch
                    checked={settings.cosmetic as boolean}
                    onCheckedChange={(v) => onSettingChange("cosmetic", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Block popups</Label>
                  <Switch
                    checked={settings.popupBlocking as boolean}
                    onCheckedChange={(v) => onSettingChange("popupBlocking", v)}
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Sliders className="w-4 h-4" /> Advanced
              </h4>
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Advanced user mode</Label>
                  <Switch
                    checked={settings.advancedMode as boolean}
                    onCheckedChange={(v) => onSettingChange("advancedMode", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Cloud storage sync</Label>
                  <Switch
                    checked={settings.cloudStorage as boolean}
                    onCheckedChange={(v) => onSettingChange("cloudStorage", v)}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "privacy-badger":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Eye className="w-4 h-4" /> Privacy
              </h4>
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Learning mode</Label>
                  <Switch
                    checked={settings.learningMode as boolean}
                    onCheckedChange={(v) => onSettingChange("learningMode", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Prevent WebRTC IP leak</Label>
                  <Switch
                    checked={settings.preventTracking as boolean}
                    onCheckedChange={(v) => onSettingChange("preventTracking", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Check for DNT policy</Label>
                  <Switch
                    checked={settings.checkDNT as boolean}
                    onCheckedChange={(v) => onSettingChange("checkDNT", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Replace social widgets</Label>
                  <Switch
                    checked={settings.socialWidgets as boolean}
                    onCheckedChange={(v) => onSettingChange("socialWidgets", v)}
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Bell className="w-4 h-4" /> Display
              </h4>
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Show tracker count in icon</Label>
                  <Switch
                    checked={settings.showCount as boolean}
                    onCheckedChange={(v) => onSettingChange("showCount", v)}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "bitwarden":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Auto-fill
              </h4>
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Auto-fill on page load</Label>
                  <Switch
                    checked={settings.autoFill as boolean}
                    onCheckedChange={(v) => onSettingChange("autoFill", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Auto-save new logins</Label>
                  <Switch
                    checked={settings.autoSave as boolean}
                    onCheckedChange={(v) => onSettingChange("autoSave", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Show website icons</Label>
                  <Switch
                    checked={settings.showIcons as boolean}
                    onCheckedChange={(v) => onSettingChange("showIcons", v)}
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Security
              </h4>
              <div className="space-y-3 pl-2">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-gray-400">Lock timeout (minutes)</Label>
                    <span className="text-sm text-gray-500">{settings.lockTimeout}</span>
                  </div>
                  <Slider
                    value={[settings.lockTimeout as number]}
                    onValueChange={([v]) => onSettingChange("lockTimeout", v)}
                    min={1}
                    max={60}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-gray-400">Clear clipboard (seconds)</Label>
                    <span className="text-sm text-gray-500">{settings.clearClipboard}</span>
                  </div>
                  <Slider
                    value={[settings.clearClipboard as number]}
                    onValueChange={([v]) => onSettingChange("clearClipboard", v)}
                    min={10}
                    max={120}
                    step={10}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Master password re-prompt</Label>
                  <Switch
                    checked={settings.masterPasswordReprompt as boolean}
                    onCheckedChange={(v) => onSettingChange("masterPasswordReprompt", v)}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "grammarly":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Writing
              </h4>
              <div className="space-y-3 pl-2">
                <div className="space-y-2">
                  <Label className="text-sm text-gray-400">Writing style</Label>
                  <Select
                    value={settings.writingStyle as string}
                    onValueChange={(v) => onSettingChange("writingStyle", v)}
                  >
                    <SelectTrigger className="bg-[#35363a] border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#35363a] border-gray-600">
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-gray-400">English dialect</Label>
                  <Select
                    value={settings.dialect as string}
                    onValueChange={(v) => onSettingChange("dialect", v)}
                  >
                    <SelectTrigger className="bg-[#35363a] border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#35363a] border-gray-600">
                      <SelectItem value="american">American English</SelectItem>
                      <SelectItem value="british">British English</SelectItem>
                      <SelectItem value="canadian">Canadian English</SelectItem>
                      <SelectItem value="australian">Australian English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Zap className="w-4 h-4" /> Features
              </h4>
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Show writing assistant</Label>
                  <Switch
                    checked={settings.showAssistant as boolean}
                    onCheckedChange={(v) => onSettingChange("showAssistant", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Synonyms suggestions</Label>
                  <Switch
                    checked={settings.synonyms as boolean}
                    onCheckedChange={(v) => onSettingChange("synonyms", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Tone detection</Label>
                  <Switch
                    checked={settings.toneDetection as boolean}
                    onCheckedChange={(v) => onSettingChange("toneDetection", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Weekly writing report</Label>
                  <Switch
                    checked={settings.weeklyReport as boolean}
                    onCheckedChange={(v) => onSettingChange("weeklyReport", v)}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "translate":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Translation
              </h4>
              <div className="space-y-3 pl-2">
                <div className="space-y-2">
                  <Label className="text-sm text-gray-400">Target language</Label>
                  <Select
                    value={settings.targetLanguage as string}
                    onValueChange={(v) => onSettingChange("targetLanguage", v)}
                  >
                    <SelectTrigger className="bg-[#35363a] border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#35363a] border-gray-600">
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="zh">Chinese</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                      <SelectItem value="ko">Korean</SelectItem>
                      <SelectItem value="ru">Russian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Auto-translate pages</Label>
                  <Switch
                    checked={settings.autoTranslate as boolean}
                    onCheckedChange={(v) => onSettingChange("autoTranslate", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Show original text on hover</Label>
                  <Switch
                    checked={settings.showOriginal as boolean}
                    onCheckedChange={(v) => onSettingChange("showOriginal", v)}
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Sliders className="w-4 h-4" /> Options
              </h4>
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Popup translation</Label>
                  <Switch
                    checked={settings.popupTranslate as boolean}
                    onCheckedChange={(v) => onSettingChange("popupTranslate", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Speak translation</Label>
                  <Switch
                    checked={settings.speakTranslation as boolean}
                    onCheckedChange={(v) => onSettingChange("speakTranslation", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-400">Highlight translated text</Label>
                  <Switch
                    checked={settings.highlightText as boolean}
                    onCheckedChange={(v) => onSettingChange("highlightText", v)}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="py-8 text-center text-gray-400">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No settings available for this extension.</p>
          </div>
        );
    }
  };

  const renderPermissions = () => {
    if (extPermissions.length === 0) {
      return (
        <div className="py-8 text-center text-gray-400">
          <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No permissions required for this extension.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Permission Summary */}
        <div className="p-4 rounded-xl bg-[#2d2e31] border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-300">Permission Summary</h4>
            <Badge className="bg-blue-500/20 text-blue-400">
              {enabledPermCount}/{extPermissionIds.length} enabled
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {highRiskCount > 0 && (
              <div className="flex items-center gap-1.5 text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{highRiskCount} high-risk</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-gray-400">
              <Lock className="w-3.5 h-3.5" />
              <span>{requiredPerms.length} required</span>
            </div>
          </div>
        </div>

        {/* Permission List */}
        <div className="space-y-2">
          {extPermissions.map((perm) => {
            const isRequired = requiredPerms.includes(perm.id);
            const isEnabled = permissions[perm.id] !== false;

            return (
              <div
                key={perm.id}
                className={`p-4 rounded-xl border transition-all ${
                  isEnabled 
                    ? 'bg-[#2d2e31] border-gray-600' 
                    : 'bg-[#252628] border-gray-700 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${riskBgColors[perm.riskLevel]}`}>
                    <div className={riskColors[perm.riskLevel]}>
                      {perm.icon}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="font-medium text-white text-sm">{perm.name}</h5>
                      {isRequired && (
                        <Badge className="bg-gray-600/50 text-gray-400 text-xs">
                          Required
                        </Badge>
                      )}
                      <Badge className={`text-xs ${
                        perm.riskLevel === "high" 
                          ? "bg-red-500/20 text-red-400" 
                          : perm.riskLevel === "medium"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-green-500/20 text-green-400"
                      }`}>
                        {perm.riskLevel} risk
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400">{perm.description}</p>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    {isRequired ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                    ) : (
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(v) => onPermissionChange(perm.id, v)}
                        className="data-[state=checked]:bg-blue-600"
                      />
                    )}
                  </div>
                </div>
                
                {/* Warning for high-risk permissions */}
                {isEnabled && perm.riskLevel === "high" && !isRequired && (
                  <div className="mt-3 pt-3 border-t border-gray-700 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-500/80">
                      This permission grants significant access. Disable if not needed for your use case.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Revoke All Optional Permissions */}
        <Button
          variant="outline"
          size="sm"
          className="w-full border-gray-600 text-gray-400 hover:text-white hover:bg-white/10 mt-4"
          onClick={() => {
            extPermissionIds.forEach(permId => {
              if (!requiredPerms.includes(permId)) {
                onPermissionChange(permId, false);
              }
            });
            toast.success("Optional permissions revoked");
          }}
        >
          <XCircle className="w-4 h-4 mr-2" />
          Revoke All Optional Permissions
        </Button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Settings Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-700">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#35363a] flex items-center justify-center">
            {extension.icon}
          </div>
          <div>
            <h3 className="font-semibold text-white">{extension.name}</h3>
            <p className="text-xs text-gray-500">v{extension.version} • by {extension.author}</p>
          </div>
        </div>
      </div>

      {/* Settings/Permissions Tabs */}
      <div className="px-4 pt-4">
        <Tabs value={activeSettingsTab} onValueChange={(v) => setActiveSettingsTab(v as "settings" | "permissions")}>
          <TabsList className="w-full bg-[#35363a] border-gray-600">
            <TabsTrigger 
              value="settings" 
              className="flex-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger 
              value="permissions" 
              className="flex-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Key className="w-4 h-4 mr-2" />
              Permissions
              {highRiskCount > 0 && (
                <Badge className="ml-2 bg-red-500/30 text-red-400 text-xs">
                  {highRiskCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        {activeSettingsTab === "settings" ? renderSettings() : renderPermissions()}
      </ScrollArea>

      {/* Settings Footer */}
      <div className="p-4 border-t border-gray-700 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white hover:bg-white/10"
          onClick={() => {
            if (activeSettingsTab === "settings") {
              const defaults = defaultExtensionSettings[extension.id];
              if (defaults) {
                Object.entries(defaults).forEach(([key, value]) => {
                  onSettingChange(key, value);
                });
                toast.success("Settings reset to defaults");
              }
            } else {
              // Reset permissions to all enabled
              extPermissionIds.forEach(permId => {
                onPermissionChange(permId, true);
              });
              toast.success("Permissions reset to defaults");
            }
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => {
            toast.success(`${extension.name} ${activeSettingsTab} saved`);
            onClose();
          }}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export const ExtensionsManager = ({
  isOpen,
  onClose,
  extensions,
  onToggleExtension,
  onRemoveExtension,
  onInstallExtension
}: ExtensionsManagerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("installed");
  const [settingsExtension, setSettingsExtension] = useState<Extension | null>(null);
  const [extensionSettings, setExtensionSettings] = useState<ExtensionSettings>(defaultExtensionSettings);
  const [permissionStates, setPermissionStates] = useState<ExtensionPermissionState>(getDefaultPermissionState());

  const handleSettingChange = (extId: string, key: string, value: string | boolean | number) => {
    setExtensionSettings(prev => ({
      ...prev,
      [extId]: {
        ...prev[extId],
        [key]: value
      }
    }));
  };

  const handlePermissionChange = (extId: string, permId: string, enabled: boolean) => {
    setPermissionStates(prev => ({
      ...prev,
      [extId]: {
        ...prev[extId],
        [permId]: enabled
      }
    }));
  };

  const filteredInstalled = extensions.filter(ext => 
    ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ext.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAvailable = availableExtensions.filter(ext => 
    !extensions.find(e => e.id === ext.id) &&
    (ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     ext.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const enabledCount = extensions.filter(e => e.enabled).length;

  // Show settings panel for an extension
  if (settingsExtension) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] bg-[#202124] border-gray-700 text-white p-0 overflow-hidden">
          <ExtensionSettingsPanel
            extension={settingsExtension}
            settings={extensionSettings[settingsExtension.id] || {}}
            onSettingChange={(key, value) => handleSettingChange(settingsExtension.id, key, value)}
            permissions={permissionStates[settingsExtension.id] || {}}
            onPermissionChange={(permId, enabled) => handlePermissionChange(settingsExtension.id, permId, enabled)}
            onClose={() => setSettingsExtension(null)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] bg-[#202124] border-gray-700 text-white p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Puzzle className="w-5 h-5 text-white" />
            </div>
            Extensions
            <Badge variant="secondary" className="ml-2 bg-blue-500/20 text-blue-400">
              {enabledCount} active
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search extensions..."
              className="pl-10 bg-[#35363a] border-gray-600 text-white placeholder:text-gray-500 focus:ring-blue-500/50"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full bg-[#35363a] border-gray-600 mb-4">
              <TabsTrigger 
                value="installed" 
                className="flex-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                Installed ({extensions.length})
              </TabsTrigger>
              <TabsTrigger 
                value="store" 
                className="flex-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                Discover
              </TabsTrigger>
            </TabsList>

            <TabsContent value="installed" className="mt-0">
              <ScrollArea className="h-[400px] pr-4">
                {filteredInstalled.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Puzzle className="w-12 h-12 text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-400 mb-2">
                      {searchQuery ? "No extensions found" : "No extensions installed"}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {searchQuery ? "Try a different search term" : "Browse the store to discover extensions"}
                    </p>
                    {!searchQuery && (
                      <Button
                        variant="outline"
                        className="border-gray-600 text-gray-300 hover:bg-white/10"
                        onClick={() => setActiveTab("store")}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Browse Extensions
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredInstalled.map((ext) => (
                      <div
                        key={ext.id}
                        className={`p-4 rounded-xl border transition-all ${
                          ext.enabled 
                            ? 'bg-[#2d2e31] border-gray-600' 
                            : 'bg-[#252628] border-gray-700 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            ext.enabled ? 'bg-[#35363a]' : 'bg-[#2d2e31]'
                          }`}>
                            {ext.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-white truncate">{ext.name}</h3>
                              <Badge className={`text-xs ${categoryColors[ext.category]}`}>
                                {ext.category}
                              </Badge>
                              <span className="text-xs text-gray-500">v{ext.version}</span>
                            </div>
                            <p className="text-sm text-gray-400 line-clamp-2 mb-2">{ext.description}</p>
                            <p className="text-xs text-gray-500">by {ext.author}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Switch
                              checked={ext.enabled}
                              onCheckedChange={() => onToggleExtension(ext.id)}
                              className="data-[state=checked]:bg-blue-600"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
                              onClick={() => setSettingsExtension(ext)}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => onRemoveExtension(ext.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="store" className="mt-0">
              <ScrollArea className="h-[400px] pr-4">
                {filteredAvailable.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Puzzle className="w-12 h-12 text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-400 mb-2">
                      {searchQuery ? "No extensions found" : "All extensions installed!"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {searchQuery ? "Try a different search term" : "You have installed all available extensions"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAvailable.map((ext) => (
                      <div
                        key={ext.id}
                        className="p-4 rounded-xl bg-[#2d2e31] border border-gray-600 hover:border-gray-500 transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-[#35363a] flex items-center justify-center flex-shrink-0">
                            {ext.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-white truncate">{ext.name}</h3>
                              <Badge className={`text-xs ${categoryColors[ext.category]}`}>
                                {ext.category}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-400 line-clamp-2 mb-2">{ext.description}</p>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>by {ext.author}</span>
                              <span>•</span>
                              <span>v{ext.version}</span>
                              <span>•</span>
                              <span>{ext.size}</span>
                            </div>
                          </div>
                          <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                            onClick={() => onInstallExtension({ ...ext, enabled: true })}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Install
                          </Button>
                        </div>
                        
                        {/* Permissions */}
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <p className="text-xs text-gray-500 mb-1">Permissions required:</p>
                          <div className="flex flex-wrap gap-1">
                            {ext.permissions.map((perm, i) => (
                              <span key={i} className="text-xs bg-[#35363a] text-gray-400 px-2 py-0.5 rounded">
                                {perm}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-[#1a1b1e] flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {extensions.length} extension{extensions.length !== 1 ? 's' : ''} installed
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-white/10"
              onClick={() => {
                extensions.forEach(ext => {
                  if (ext.enabled) onToggleExtension(ext.id);
                });
                toast.success("All extensions disabled");
              }}
            >
              <Power className="w-4 h-4 mr-2" />
              Disable All
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};