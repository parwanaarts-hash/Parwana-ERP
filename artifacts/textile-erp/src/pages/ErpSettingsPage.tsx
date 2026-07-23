import { PageShell } from "@/components/layout/PageShell";

export default function ErpSettingsPage() {
  return (
    <PageShell 
      title="ERP Settings" 
      breadcrumb={["ERP","Settings"]}
    >
      <div className="flex-1 p-6 flex items-center justify-center text-muted-foreground" data-testid="container-settings-placeholder">
        ERP settings configuration options will appear here.
      </div>
      <div className="p-4 bg-muted/10 shrink-0 border-t" data-testid="container-form-erpsettingspage">
        <h3 className="font-semibold text-sm mb-4">Configuration Placeholder</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Configuration Item</label>
            <input placeholder="Configure setting" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" data-testid="input-form-ref" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
