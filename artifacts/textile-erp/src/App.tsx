import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

import ModuleSelector from '@/pages/ModuleSelector';
import { AppShell } from '@/components/layout/AppShell';

import PurchaseGatePassPage from '@/pages/PurchaseGatePassPage';
import PurchaseBillPage from '@/pages/PurchaseBillPage';
import PaymentPaidPage from '@/pages/PaymentPaidPage';
import SaleGatePassPage from '@/pages/SaleGatePassPage';
import SalesBillPage from '@/pages/SalesBillPage';
import PaymentReceivePage from '@/pages/PaymentReceivePage';
import ReturnGatePassPage from '@/pages/ReturnGatePassPage';
import ReturnBillPage from '@/pages/ReturnBillPage';
import ProductsPage from '@/pages/ProductsPage';
import CategoriesPage from '@/pages/CategoriesPage';
import ShikanjaPage from '@/pages/ShikanjaPage';
import PurchasePartiesPage from '@/pages/PurchasePartiesPage';
import SalePartiesPage from '@/pages/SalePartiesPage';
import PurchaseReportPage from '@/pages/PurchaseReportPage';
import SalesReportPage from '@/pages/SalesReportPage';
import ReturnReportPage from '@/pages/ReturnReportPage';
import PaymentReportPage from '@/pages/PaymentReportPage';
import StockReportPage from '@/pages/StockReportPage';
import SettingsPage from '@/pages/SettingsPage';
import ErpSalesPage from '@/pages/ErpSalesPage';
import ErpPurchasePage from '@/pages/ErpPurchasePage';
import ErpReportsPage from '@/pages/ErpReportsPage';
import ErpAddPage from '@/pages/ErpAddPage';
import ErpSettingsPage from '@/pages/ErpSettingsPage';

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();

  if (location === '/') {
    return <ModuleSelector />;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/stock/purchase/gate-passes" component={PurchaseGatePassPage} />
        <Route path="/stock/purchase/bills" component={PurchaseBillPage} />
        <Route path="/stock/purchase/payments" component={PaymentPaidPage} />
        
        <Route path="/stock/sales/gate-passes" component={SaleGatePassPage} />
        <Route path="/stock/sales/bills" component={SalesBillPage} />
        <Route path="/stock/sales/payments" component={PaymentReceivePage} />
        
        <Route path="/stock/returns/gate-passes" component={ReturnGatePassPage} />
        <Route path="/stock/returns/bills" component={ReturnBillPage} />
        
        <Route path="/stock/add/products" component={ProductsPage} />
        <Route path="/stock/add/categories" component={CategoriesPage} />
        <Route path="/stock/add/shikanja" component={ShikanjaPage} />
        <Route path="/stock/add/purchase-parties" component={PurchasePartiesPage} />
        <Route path="/stock/add/sale-parties" component={SalePartiesPage} />
        
        <Route path="/stock/reports/purchase" component={PurchaseReportPage} />
        <Route path="/stock/reports/sales" component={SalesReportPage} />
        <Route path="/stock/reports/returns" component={ReturnReportPage} />
        <Route path="/stock/reports/payments" component={PaymentReportPage} />
        <Route path="/stock/reports/stock" component={StockReportPage} />
        
        <Route path="/stock/settings" component={SettingsPage} />

        <Route path="/erp/sales" component={ErpSalesPage} />
        <Route path="/erp/purchase" component={ErpPurchasePage} />
        <Route path="/erp/reports" component={ErpReportsPage} />
        <Route path="/erp/add" component={ErpAddPage} />
        <Route path="/erp/settings" component={ErpSettingsPage} />

        <Route component={NotFound} />
      </Switch>
    </AppShell>
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
