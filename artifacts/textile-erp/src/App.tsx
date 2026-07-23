import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

// ── Layout ────────────────────────────────────────────────────────────────────
import { AppShell } from '@/components/layout/AppShell';

// ── Dashboard pages (no sidebar) ──────────────────────────────────────────────
import ModuleSelector       from '@/pages/ModuleSelector';        // Home (/)
import StockModulePage      from '@/pages/StockModulePage';
import StockPurchaseSectionPage from '@/pages/StockPurchaseSectionPage';
import StockSalesSectionPage    from '@/pages/StockSalesSectionPage';
import StockReturnSectionPage   from '@/pages/StockReturnSectionPage';
import StockAddSectionPage      from '@/pages/StockAddSectionPage';
import StockReportsSectionPage  from '@/pages/StockReportsSectionPage';

import ErpModulePage            from '@/pages/ErpModulePage';
import ErpPurchasePage          from '@/pages/ErpPurchasePage';
import ErpSalesPage             from '@/pages/ErpSalesPage';
import ErpPaymentsSectionPage   from '@/pages/ErpPaymentsSectionPage';
import ErpReturnSectionPage     from '@/pages/ErpReturnSectionPage';
import ErpAccountsSectionPage   from '@/pages/ErpAccountsSectionPage';
import ErpReportsPage           from '@/pages/ErpReportsPage';
import ErpSettingsPage          from '@/pages/ErpSettingsPage';

// ── CRUD screens (rendered inside AppShell with sidebar) ──────────────────────
import PurchaseGatePassPage  from '@/pages/PurchaseGatePassPage';
import PurchaseBillPage      from '@/pages/PurchaseBillPage';
import PaymentPaidPage       from '@/pages/PaymentPaidPage';
import SaleGatePassPage      from '@/pages/SaleGatePassPage';
import SalesBillPage         from '@/pages/SalesBillPage';
import PaymentReceivePage    from '@/pages/PaymentReceivePage';
import ReturnGatePassPage    from '@/pages/ReturnGatePassPage';
import ReturnBillPage        from '@/pages/ReturnBillPage';
import ProductsPage          from '@/pages/ProductsPage';
import CategoriesPage        from '@/pages/CategoriesPage';
import ShikanjaPage          from '@/pages/ShikanjaPage';
import PurchasePartiesPage   from '@/pages/PurchasePartiesPage';
import SalePartiesPage       from '@/pages/SalePartiesPage';
import PurchaseReportPage    from '@/pages/PurchaseReportPage';
import SalesReportPage       from '@/pages/SalesReportPage';
import ReturnReportPage      from '@/pages/ReturnReportPage';
import PaymentReportPage     from '@/pages/PaymentReportPage';
import StockReportPage       from '@/pages/StockReportPage';
import SettingsPage          from '@/pages/SettingsPage';
import NotFound              from '@/pages/not-found';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* ── Dashboard pages – no sidebar ─────────────────────────────────── */}
      <Route path="/"                 component={ModuleSelector} />

      {/* Stock module navigation */}
      <Route path="/stock"            component={StockModulePage} />
      <Route path="/stock/purchase"   component={StockPurchaseSectionPage} />
      <Route path="/stock/sales"      component={StockSalesSectionPage} />
      <Route path="/stock/returns"    component={StockReturnSectionPage} />
      <Route path="/stock/add"        component={StockAddSectionPage} />
      <Route path="/stock/reports"    component={StockReportsSectionPage} />

      {/* ERP module navigation */}
      <Route path="/erp"              component={ErpModulePage} />
      <Route path="/erp/purchase"     component={ErpPurchasePage} />
      <Route path="/erp/sales"        component={ErpSalesPage} />
      <Route path="/erp/payments"     component={ErpPaymentsSectionPage} />
      <Route path="/erp/return"       component={ErpReturnSectionPage} />
      <Route path="/erp/ledgers"      component={ErpAccountsSectionPage} />
      <Route path="/erp/reports"      component={ErpReportsPage} />
      <Route path="/erp/settings"     component={ErpSettingsPage} />

      {/* ── CRUD screens – inside AppShell (sidebar) ─────────────────────── */}
      <Route>
        <AppShell>
          <Switch>
            {/* Stock › Purchase */}
            <Route path="/stock/purchase/gate-passes" component={PurchaseGatePassPage} />
            <Route path="/stock/purchase/bills"       component={PurchaseBillPage} />
            <Route path="/stock/purchase/payments"    component={PaymentPaidPage} />

            {/* Stock › Sales */}
            <Route path="/stock/sales/gate-passes"    component={SaleGatePassPage} />
            <Route path="/stock/sales/bills"          component={SalesBillPage} />
            <Route path="/stock/sales/payments"       component={PaymentReceivePage} />

            {/* Stock › Returns */}
            <Route path="/stock/returns/gate-passes"  component={ReturnGatePassPage} />
            <Route path="/stock/returns/bills"        component={ReturnBillPage} />

            {/* Stock › Add (master data) */}
            <Route path="/stock/add/products"         component={ProductsPage} />
            <Route path="/stock/add/categories"       component={CategoriesPage} />
            <Route path="/stock/add/shikanja"         component={ShikanjaPage} />
            <Route path="/stock/add/purchase-parties" component={PurchasePartiesPage} />
            <Route path="/stock/add/sale-parties"     component={SalePartiesPage} />

            {/* Stock › Reports */}
            <Route path="/stock/reports/purchase"       component={PurchaseReportPage} />
            <Route path="/stock/reports/sales"          component={SalesReportPage} />
            <Route path="/stock/reports/returns"        component={ReturnReportPage} />
            <Route path="/stock/reports/payments"       component={PaymentReportPage} />
            <Route path="/stock/reports/stock"          component={StockReportPage} />
            <Route path="/stock/reports/product-ledger" component={StockReportPage} />

            {/* Stock › Settings */}
            <Route path="/stock/settings"             component={SettingsPage} />

            <Route component={NotFound} />
          </Switch>
        </AppShell>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
