const fs = require('fs');
const path = require('path');

const pages = [
  { name: 'PurchaseGatePassPage', title: 'Purchase Gate Pass', breadcrumb: ['Stock', 'Purchase', 'Gate Pass'], columns: ['GP#', 'Date', 'Party', 'Lot#', 'Items', 'Remarks', 'Bill#'] },
  { name: 'PurchaseBillPage', title: 'Purchase Bill', breadcrumb: ['Stock', 'Purchase', 'Bill'], columns: ['Bill#', 'Date', 'Party', 'Supplier Bill#', 'Lot#', 'Amount'] },
  { name: 'PaymentPaidPage', title: 'Payment Paid', breadcrumb: ['Stock', 'Purchase', 'Payment Paid'], columns: ['PP#', 'Date', 'Party', 'Mode', 'Amount', 'Remarks'] },
  { name: 'SaleGatePassPage', title: 'Sale Gate Pass', breadcrumb: ['Stock', 'Sales', 'Gate Pass'], columns: ['GP#', 'Date', 'Party', 'No. of Bags', 'Shikanja', 'Bill#'] },
  { name: 'SalesBillPage', title: 'Sales Bill', breadcrumb: ['Stock', 'Sales', 'Bill'], columns: ['Bill#', 'Date', 'Party', 'Bill Type', 'Cash', 'Bank', 'Total'] },
  { name: 'PaymentReceivePage', title: 'Payment Receive', breadcrumb: ['Stock', 'Sales', 'Payment Receive'], columns: ['PR#', 'Date', 'Party', 'Mode', 'Amount', 'Remarks'] },
  { name: 'ReturnGatePassPage', title: 'Return Gate Pass', breadcrumb: ['Stock', 'Returns', 'Gate Pass'], columns: ['GP#', 'Date', 'Party', 'Return Type', 'Bill#'] },
  { name: 'ReturnBillPage', title: 'Return Bill', breadcrumb: ['Stock', 'Returns', 'Bill'], columns: ['Bill#', 'Date', 'Party', 'Amount'] },
  { name: 'ProductsPage', title: 'Products', breadcrumb: ['Stock', 'Add', 'Products'], columns: ['Item Code', 'Product Name', 'Type', 'Category', 'Shikanja'] },
  { name: 'CategoriesPage', title: 'Categories', breadcrumb: ['Stock', 'Add', 'Categories'], columns: ['ID', 'Name', 'Parent Category'] },
  { name: 'ShikanjaPage', title: 'Shikanja', breadcrumb: ['Stock', 'Add', 'Shikanja'], columns: ['ID', 'Name'] },
  { name: 'PurchasePartiesPage', title: 'Purchase Parties', breadcrumb: ['Stock', 'Add', 'Purchase Parties'], columns: ['ID', 'Name', 'Phone', 'City', 'Opening Balance'] },
  { name: 'SalePartiesPage', title: 'Sale Parties', breadcrumb: ['Stock', 'Add', 'Sale Parties'], columns: ['ID', 'Name', 'Phone', 'City', 'Credit Limit'] },
  { name: 'PurchaseReportPage', title: 'Purchase Register', breadcrumb: ['Stock', 'Reports', 'Purchase Register'], columns: ['Bill#', 'Date', 'Party', 'Amount'] },
  { name: 'SalesReportPage', title: 'Sales Register', breadcrumb: ['Stock', 'Reports', 'Sales Register'], columns: ['Bill#', 'Date', 'Party', 'Amount'] },
  { name: 'ReturnReportPage', title: 'Return Register', breadcrumb: ['Stock', 'Reports', 'Return Register'], columns: ['Bill#', 'Date', 'Party', 'Amount'] },
  { name: 'PaymentReportPage', title: 'Payment Reports', breadcrumb: ['Stock', 'Reports', 'Payment Reports'], columns: ['Doc#', 'Date', 'Party', 'Mode', 'Amount'] },
  { name: 'StockReportPage', title: 'Stock Reports', breadcrumb: ['Stock', 'Reports', 'Stock Reports'], columns: ['Item Code', 'Product Name', 'Type', 'Balance'] },
  { name: 'SettingsPage', title: 'Settings', breadcrumb: ['Stock', 'Settings'], columns: [] },
  { name: 'ErpSalesPage', title: 'ERP Sales', breadcrumb: ['ERP', 'Sales'], columns: ['ID', 'Details'] },
  { name: 'ErpPurchasePage', title: 'ERP Purchase', breadcrumb: ['ERP', 'Purchase'], columns: ['ID', 'Details'] },
  { name: 'ErpReportsPage', title: 'ERP Reports', breadcrumb: ['ERP', 'Reports'], columns: ['ID', 'Details'] },
  { name: 'ErpAddPage', title: 'ERP Add Data', breadcrumb: ['ERP', 'Add Data'], columns: ['ID', 'Details'] },
  { name: 'ErpSettingsPage', title: 'ERP Settings', breadcrumb: ['ERP', 'Settings'], columns: [] },
];

pages.forEach(p => {
  const isSettings = p.columns.length === 0;
  
  const content = `import { PageShell } from "@/components/layout/PageShell";

export default function ${p.name}() {
  return (
    <PageShell 
      title="${p.title}" 
      breadcrumb={${JSON.stringify(p.breadcrumb)}}
    >
      ${!isSettings ? `
      {/* Grid Placeholder */}
      <div className="flex-1 overflow-auto border-b" data-testid="container-grid-${p.name.toLowerCase()}">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 shadow-sm">
            <tr>
              ${p.columns.map(c => `<th className="px-4 py-3 font-medium border-b">${c}</th>`).join('\n              ')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={${p.columns.length}} className="px-4 py-12 text-center text-muted-foreground" data-testid="text-empty-grid">
                No records found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>` : `
      <div className="flex-1 p-6 flex items-center justify-center text-muted-foreground" data-testid="container-settings-placeholder">
        Settings configuration options will appear here.
      </div>
      `}

      {/* Form Placeholder */}
      <div className="p-4 bg-muted/10 shrink-0 border-t" data-testid="container-form-${p.name.toLowerCase()}">
        <h3 className="font-semibold text-sm mb-4">Entry Form Placeholder</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Date</label>
            <input type="date" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" data-testid="input-form-date" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Primary Reference</label>
            <input placeholder="Auto-generated or entered" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" data-testid="input-form-ref" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Remarks / Details</label>
            <input placeholder="Additional details..." className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" data-testid="input-form-remarks" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
`;
  fs.writeFileSync(path.join(__dirname, 'src', 'pages', p.name + '.tsx'), content);
});
