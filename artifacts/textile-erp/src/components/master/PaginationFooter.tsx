import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationFooterProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (newPage: number) => void;
}

export function PaginationFooter({ page, pageSize, total, onPageChange }: PaginationFooterProps) {
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, total);
  
  return (
    <div className="flex items-center justify-between p-3 bg-card border rounded-md shadow-sm text-sm shrink-0" data-testid="container-pagination">
      <div className="text-muted-foreground" data-testid="text-pagination-info">
        Showing <span className="font-medium text-foreground">{start}</span>–<span className="font-medium text-foreground">{end}</span> of <span className="font-medium text-foreground">{total}</span> records
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          data-testid="button-pagination-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button 
          onClick={() => onPageChange(page + 1)}
          disabled={end >= total}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          data-testid="button-pagination-next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}