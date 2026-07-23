import { PageShell } from "@/components/layout/PageShell";

export default function PaymentPaidPage() {
  return (
    <PageShell 
      title="Payment Paid" 
      breadcrumb={["Stock","Purchase","Payment Paid"]}
    >
      <div className="flex-1 overflow-auto border-b" data-testid="container-grid-paymentpaidpage">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 font-medium border-b">PP#</th>
              <th className="px-4 py-3 font-medium border-b">Date</th>
              <th className="px-4 py-3 font-medium border-b">Party</th>
              <th className="px-4 py-3 font-medium border-b">Mode</th>
              <th className="px-4 py-3 font-medium border-b">Amount</th>
              <th className="px-4 py-3 font-medium border-b">Remarks</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground" data-testid="text-empty-grid">
                No records found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-muted/10 shrink-0 border-t" data-testid="container-form-paymentpaidpage">
        <h3 className="font-semibold text-sm mb-4">Entry Form Placeholder</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Date</label>
            <input type="date" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" data-testid="input-form-date" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Payment Reference</label>
            <input placeholder="Auto-generated" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" data-testid="input-form-ref" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Remarks</label>
            <input placeholder="Details..." className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" data-testid="input-form-remarks" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
