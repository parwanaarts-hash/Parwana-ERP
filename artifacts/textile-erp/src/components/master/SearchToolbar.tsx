import { Search } from "lucide-react";
import { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchToolbarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder?: string;
  children?: ReactNode;
}

export function SearchToolbar({ value, onChange, onSearch, placeholder = "Search records...", children }: SearchToolbarProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-card border rounded-md shadow-sm shrink-0" data-testid="container-search-toolbar">
      <Input 
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSearch();
          }
        }}
        className="w-64 h-9"
        data-testid="input-search-toolbar" 
      />
      {children}
      <Button 
        onClick={onSearch}
        className="ml-auto h-9"
        data-testid="button-search-toolbar"
      >
        <Search className="h-4 w-4 mr-2" />
        Search
      </Button>
    </div>
  );
}