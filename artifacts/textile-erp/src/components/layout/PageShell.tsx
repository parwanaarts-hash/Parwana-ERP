import { ReactNode } from "react";
import { Header } from "./Header";
import { Breadcrumb } from "./Breadcrumb";
import { Toolbar } from "./Toolbar";
import { Search } from "lucide-react";

interface PageShellProps {
  title: string;
  breadcrumb: string[];
  children: ReactNode;
}

export function PageShell({ title, breadcrumb, children }: PageShellProps) {
  return (
    <div className="flex flex-col h-full w-full bg-background">
      <Header title={title} />
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Breadcrumb items={breadcrumb} />
        </div>
        
        <Toolbar />

        {/* Filter Section Placeholder */}
        <div className="flex items-center gap-3 p-3 bg-card border rounded-md shadow-sm" data-testid="container-filter">
          <input 
            placeholder="Search records..." 
            className="flex h-9 w-64 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" 
            data-testid="input-filter-search" 
          />
          <select className="flex h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" data-testid="select-filter-party">
            <option>All Parties</option>
          </select>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              className="flex h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" 
              data-testid="input-filter-date-start" 
            />
            <span className="text-muted-foreground text-sm">to</span>
            <input 
              type="date" 
              className="flex h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" 
              data-testid="input-filter-date-end" 
            />
          </div>
          <button className="ml-auto inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2" data-testid="button-filter-search">
            <Search className="h-4 w-4 mr-2" />
            Search
          </button>
        </div>

        <div className="flex-1 bg-card rounded-md border shadow-sm flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
