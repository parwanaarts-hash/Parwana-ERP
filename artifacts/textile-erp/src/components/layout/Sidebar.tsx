import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, ChevronRight, LayoutGrid, Package, TrendingDown, ArrowRightLeft, FileText, PlusCircle, Settings, Layers } from "lucide-react";

const stockNav = [
  {
    title: "Purchase",
    icon: <ArrowRightLeft className="w-4 h-4 mr-2" />,
    items: [
      { label: "Purchase Gate Pass", href: "/stock/purchase/gate-passes" },
      { label: "Purchase Bill", href: "/stock/purchase/bills" },
      { label: "Payment Paid", href: "/stock/purchase/payments" },
    ]
  },
  {
    title: "Sales",
    icon: <TrendingDown className="w-4 h-4 mr-2" />,
    items: [
      { label: "Sale Gate Pass", href: "/stock/sales/gate-passes" },
      { label: "Sales Bill", href: "/stock/sales/bills" },
      { label: "Payment Receive", href: "/stock/sales/payments" },
    ]
  },
  {
    title: "Return",
    icon: <ArrowRightLeft className="w-4 h-4 mr-2" />,
    items: [
      { label: "Return Gate Pass", href: "/stock/returns/gate-passes" },
      { label: "Return Bill", href: "/stock/returns/bills" },
    ]
  },
  {
    title: "Add (Master Data)",
    icon: <PlusCircle className="w-4 h-4 mr-2" />,
    items: [
      { label: "Products", href: "/stock/add/products" },
      { label: "Categories", href: "/stock/add/categories" },
      { label: "Shikanja", href: "/stock/add/shikanja" },
      { label: "Purchase Parties", href: "/stock/add/purchase-parties" },
      { label: "Sale Parties", href: "/stock/add/sale-parties" },
    ]
  },
  {
    title: "Reports",
    icon: <FileText className="w-4 h-4 mr-2" />,
    items: [
      { label: "Purchase Register", href: "/stock/reports/purchase" },
      { label: "Sales Register", href: "/stock/reports/sales" },
      { label: "Return Register", href: "/stock/reports/returns" },
      { label: "Payment Reports", href: "/stock/reports/payments" },
      { label: "Stock Reports", href: "/stock/reports/stock" },
    ]
  }
];

const erpNav = [
  {
    title: "ERP Operations",
    icon: <LayoutGrid className="w-4 h-4 mr-2" />,
    items: [
      { label: "Sales", href: "/erp/sales" },
      { label: "Purchase", href: "/erp/purchase" },
      { label: "Reports", href: "/erp/reports" },
      { label: "Add", href: "/erp/add" },
      { label: "Settings", href: "/erp/settings" },
    ]
  }
];

export function Sidebar() {
  const [location] = useLocation();
  const isStock = location.startsWith("/stock");
  const navData = isStock ? stockNav : erpNav;
  const moduleName = isStock ? "Stock Module" : "ERP Module";
  
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "Purchase": true,
    "Sales": true,
    "Return": true,
    "Add (Master Data)": true,
    "Reports": true,
    "ERP Operations": true
  });

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div className="w-64 bg-sidebar border-r flex flex-col h-full shadow-sm z-10 shrink-0">
      <div className="h-14 flex items-center px-4 border-b shrink-0 bg-sidebar-accent/30">
        <Package className="w-5 h-5 mr-2 text-primary" />
        <h2 className="font-bold text-lg tracking-tight text-sidebar-foreground">{moduleName}</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-3 space-y-2">
          {navData.map((section) => (
            <div key={section.title} className="space-y-1">
              <button 
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors"
                data-testid={`button-sidebar-section-${section.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              >
                <div className="flex items-center">
                  {section.icon}
                  {section.title}
                </div>
                {openSections[section.title] ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
              </button>
              
              {openSections[section.title] && (
                <div className="pl-6 pr-2 py-1 space-y-1">
                  {section.items.map((item) => {
                    const isActive = location === item.href;
                    return (
                      <Link 
                        key={item.href} 
                        href={item.href}
                        className={`block px-3 py-1.5 text-sm rounded-md transition-colors ${isActive ? "bg-primary text-primary-foreground font-medium shadow-sm" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}
                        data-testid={`link-sidebar-${item.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
          
          {isStock && (
            <div className="mt-4 pt-4 border-t">
              <Link 
                href="/stock/settings"
                className={`flex items-center px-3 py-2 text-sm font-semibold rounded-md transition-colors ${location === "/stock/settings" ? "bg-primary text-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}
                data-testid="link-sidebar-settings"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t bg-sidebar-accent/10">
        <Link href="/" data-testid="link-sidebar-switch-module">
          <button className="flex w-full items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
            <Layers className="w-4 h-4 mr-2" />
            Switch Module
          </button>
        </Link>
      </div>
    </div>
  );
}
