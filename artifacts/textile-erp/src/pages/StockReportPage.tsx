import { PageShell } from "@/components/layout/PageShell";

export default function StockReportPage() {
  return (
    <PageShell 
      title="Stock Reports" 
      breadcrumb={["Stock","Reports","Stock Reports"]}
    >
      <div className="flex-1 overflow-auto border-b" data-testid="container-grid-stockreportpage">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 font-medium border-b">Item Code</th>
              <th className="px-4 py-3 font-medium border-b">Product Name</th>
              <th className="px-4 py-3 font-medium border-b">Type</th>
              <th className="px-4 py-3 font-medium border-b">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground" data-testid="text-empty-grid">
                No records found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-muted/10 shrink-0 border-t text-center text-muted-foreground text-sm" data-testid="container-form-stockreportpage">
        Report view — read-only data display
      </div>
    </PageShell>
  );
}
