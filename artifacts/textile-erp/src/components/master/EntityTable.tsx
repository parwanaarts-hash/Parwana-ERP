import { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  width?: string;
}

interface EntityTableProps<T extends { id: number }> {
  columns: Column<T>[];
  rows: T[];
  total: number;
  isLoading: boolean;
  selectedId?: number | null;
  onRowClick: (row: T) => void;
  emptyMessage?: string;
}

export function EntityTable<T extends { id: number }>({
  columns,
  rows,
  isLoading,
  selectedId,
  onRowClick,
  emptyMessage = "No records found."
}: EntityTableProps<T>) {
  return (
    <div className="flex-1 overflow-auto border rounded-md bg-card shadow-sm" data-testid="container-entity-table">
      <Table>
        <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
          <TableRow>
            {columns.map((col, i) => (
              <TableHead key={i} style={{ width: col.width }} className="whitespace-nowrap font-medium text-foreground">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="animate-pulse">
                {columns.map((col, j) => (
                  <TableCell key={j}>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground" data-testid="text-empty-grid">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow 
                key={row.id} 
                className={`cursor-pointer transition-colors ${selectedId === row.id ? 'bg-muted/80' : ''}`}
                onClick={() => onRowClick(row)}
                data-testid={`row-entity-${row.id}`}
              >
                {columns.map((col, j) => (
                  <TableCell key={j} className="whitespace-nowrap">
                    {col.render ? col.render(row) : (row as any)[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}