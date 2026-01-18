import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter, Clock, Globe2, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface SearchFiltersState {
  timeRange: "any" | "hour" | "day" | "week" | "month" | "year";
  region: string;
  safeSearch: boolean;
}

interface SearchFiltersProps {
  filters: SearchFiltersState;
  onFiltersChange: (filters: SearchFiltersState) => void;
  searchType: string;
}

const timeRangeLabels: Record<SearchFiltersState["timeRange"], string> = {
  any: "Any time",
  hour: "Past hour",
  day: "Past 24 hours",
  week: "Past week",
  month: "Past month",
  year: "Past year",
};

const regions = [
  { code: "us", name: "United States" },
  { code: "gb", name: "United Kingdom" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "in", name: "India" },
  { code: "jp", name: "Japan" },
];

export const SearchFilters = ({ filters, onFiltersChange, searchType }: SearchFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeFilterCount = [
    filters.timeRange !== "any",
    filters.region !== "us",
    !filters.safeSearch,
  ].filter(Boolean).length;

  const handleTimeRangeChange = (value: string) => {
    onFiltersChange({ ...filters, timeRange: value as SearchFiltersState["timeRange"] });
  };

  const handleRegionChange = (value: string) => {
    onFiltersChange({ ...filters, region: value });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      timeRange: "any",
      region: "us",
      safeSearch: true,
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Time Range Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className={`glass-effect gap-2 ${filters.timeRange !== 'any' ? 'border-primary/50 bg-primary/5' : ''}`}
          >
            <Clock className="w-4 h-4" />
            {timeRangeLabels[filters.timeRange]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Time range</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={filters.timeRange} onValueChange={handleTimeRangeChange}>
            {Object.entries(timeRangeLabels).map(([value, label]) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Region Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className={`glass-effect gap-2 ${filters.region !== 'us' ? 'border-primary/50 bg-primary/5' : ''}`}
          >
            <Globe2 className="w-4 h-4" />
            {regions.find(r => r.code === filters.region)?.name || "Region"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Search region</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={filters.region} onValueChange={handleRegionChange}>
            {regions.map((region) => (
              <DropdownMenuRadioItem key={region.code} value={region.code}>
                {region.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3" />
          Clear filters
          <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
            {activeFilterCount}
          </Badge>
        </Button>
      )}
    </div>
  );
};
