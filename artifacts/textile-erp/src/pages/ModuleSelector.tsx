import { Link } from "wouter";
import { Package, LayoutGrid } from "lucide-react";

export default function ModuleSelector() {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4 font-sans">
      <div className="mb-10 text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground" data-testid="text-title-erp">Textile ERP System</h1>
        <p className="text-muted-foreground text-lg" data-testid="text-subtitle-erp">Select a module to continue</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Link href="/stock/purchase/gate-passes" data-testid="link-module-stock">
          <div className="h-72 bg-card rounded-xl border-2 border-transparent hover:border-primary shadow-sm hover:shadow-lg transition-all cursor-pointer group flex flex-col p-8 items-center text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-card-foreground">Stock Module</h2>
            <p className="text-muted-foreground">Manage inventory, gate passes, billing, returns, and daily stock operations.</p>
          </div>
        </Link>

        <Link href="/erp/sales" data-testid="link-module-erp">
          <div className="h-72 bg-card rounded-xl border-2 border-transparent hover:border-primary shadow-sm hover:shadow-lg transition-all cursor-pointer group flex flex-col p-8 items-center text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
              <LayoutGrid className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-card-foreground">ERP Module</h2>
            <p className="text-muted-foreground">Enterprise resource planning, advanced reporting, and corporate master data.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
