import { PageShell } from "@/components/layout/PageShell";

export default function PurchaseReportPage() {
  return (
    <PageShell 
      title="Purchase Register" 
      breadcrumb={["Stock","Reports","Purchase Register"]}
    >
      <div className="flex-1 overflow-auto border-b" data-testid="container-grid-purchasereportpage">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 font-medium border-b">Bill#</th>
              <th className="px-4 py-3 font-medium border-b">Date</th>
              <th className="px-4 py-3 font-medium border-b">Party</th>
              <th className="px-4 py-3 font-medium border-b">Amount</th>
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
      <div className="p-4 bg-muted/10 shrink-0 border-t text-center text-muted-foreground text-sm" data-testid="container-form-purchasereportpage">
        Report view — read-only data display
      </div>
    </PageShell>
  );
}
