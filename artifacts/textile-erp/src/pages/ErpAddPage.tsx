import { PageShell } from "@/components/layout/PageShell";

export default function ErpAddPage() {
  return (
    <PageShell 
      title="ERP Add Data" 
      breadcrumb={["ERP","Add Data"]}
    >
      <div className="flex-1 overflow-auto border-b" data-testid="container-grid-erpaddpage">
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
      <div className="p-4 bg-muted/10 shrink-0 border-t" data-testid="container-form-erpaddpage">
        <h3 className="font-semibold text-sm mb-4">Entry Form Placeholder</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Reference</label>
            <input placeholder="ERP reference" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" data-testid="input-form-ref" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
