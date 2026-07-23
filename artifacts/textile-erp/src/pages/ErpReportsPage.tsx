import { PageShell } from "@/components/layout/PageShell";

export default function ErpReportsPage() {
  return (
    <PageShell 
      title="ERP Reports" 
      breadcrumb={["ERP","Reports"]}
    >
      <div className="flex-1 overflow-auto border-b" data-testid="container-grid-erpreportspage">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 font-medium border-b">ID</th>
              <th className="px-4 py-3 font-medium border-b">Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={2} className="px-4 py-12 text-center text-muted-foreground" data-testid="text-empty-grid">
                No records found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-muted/10 shrink-0 border-t text-center text-muted-foreground text-sm" data-testid="container-form-erpreportspage">
        Report view — read-only data display
      </div>
    </PageShell>
  );
}
