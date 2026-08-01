import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  Package,
  TrendingDown,
  ArrowRightLeft,
  FileText,
  PlusCircle,
  Settings,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const stockNav = [
  {
    title: "Purchase",
    icon: <ArrowRightLeft className="w-4 h-4 mr-2 shrink-0" />,
    items: [
      { label: "Purchase Gate Pass", href: "/stock/purchase/gate-passes" },
      { label: "Purchase Bill", href: "/stock/purchase/bills" },
      { label: "Payment Paid", href: "/stock/purchase/payments" },
    ],
  },
  {
    title: "Sales",
    icon: <TrendingDown className="w-4 h-4 mr-2 shrink-0" />,
    items: [
      { label: "Sale Gate Pass", href: "/stock/sales/gate-passes" },
      { label: "Sales Bill", href: "/stock/sales/bills" },
      { label: "Payment Receive", href: "/stock/sales/payments" },
    ],
  },
  {
    title: "Return",
    icon: <ArrowRightLeft className="w-4 h-4 mr-2 shrink-0" />,
    items: [
      { label: "Return Gate Pass", href: "/stock/returns/gate-passes" },
      { label: "Return Bill", href: "/stock/returns/bills" },
    ],
  },
  {
    title: "Add (Master Data)",
    icon: <PlusCircle className="w-4 h-4 mr-2 shrink-0" />,
    items: [
      { label: "Products", href: "/stock/add/products" },
      { label: "Categories", href: "/stock/add/categories" },
      { label: "Shikanja", href: "/stock/add/shikanja" },
      { label: "Purchase Parties", href: "/stock/add/purchase-parties" },
      { label: "Sale Parties", href: "/stock/add/sale-parties" },
    ],
  },
  {
    title: "Reports",
    icon: <FileText className="w-4 h-4 mr-2 shrink-0" />,
    items: [
      { label: "Purchase Register", href: "/stock/reports/purchase" },
      { label: "Sales Register", href: "/stock/reports/sales" },
      { label: "Return Register", href: "/stock/reports/returns" },
      { label: "Payment Reports", href: "/stock/reports/payments" },
      { label: "Stock Reports", href: "/stock/reports/stock" },
    ],
  },
];

const erpNav = [
  {
    title: "ERP Operations",
    icon: <LayoutGrid className="w-4 h-4 mr-2 shrink-0" />,
    items: [
      { label: "Sales", href: "/erp/sales" },
      { label: "Purchase", href: "/erp/purchase" },
      { label: "Reports", href: "/erp/reports" },
      { label: "Add", href: "/erp/add" },
      { label: "Settings", href: "/erp/settings" },
    ],
  },
];

interface SidebarProps {
  width: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ width, collapsed, onToggleCollapse }: SidebarProps) {
  const [location] = useLocation();
  const isStock = location.startsWith("/stock");
  const navData = isStock ? stockNav : erpNav;
  const moduleName = isStock ? "Stock Module" : "ERP Module";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Purchase: true,
    Sales: true,
    Return: true,
    "Add (Master Data)": true,
    Reports: true,
    "ERP Operations": true,
  });

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  // ── Collapsed strip ────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="w-12 bg-sidebar border-r flex flex-col h-full shadow-sm z-10 shrink-0 items-center">
        {/* Module icon */}
        <div className="h-14 flex items-center justify-center border-b w-full">
          <Package className="w-5 h-5 text-primary" />
        </div>

        {/* Expand button */}
        <button
          onClick={onToggleCollapse}
          className="mt-3 p-2 rounded-md hover:bg-sidebar-accent transition-colors text-sidebar-foreground/70 hover:text-sidebar-foreground"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        {/* Section icons (non-interactive visual hint) */}
        <div className="flex-1 flex flex-col items-center gap-3 py-4 mt-2 overflow-hidden">
          {navData.map((section) => (
            <div
              key={section.title}
              className="text-sidebar-foreground/40"
              title={section.title}
            >
              {/* Clone icon without the mr-2 */}
              <span className="[&>svg]:mr-0">{section.icon}</span>
            </div>
          ))}
        </div>

        {/* Switch Module */}
        <div className="p-2 border-t w-full flex justify-center">
          <Link href="/">
            <button
              className="p-2 rounded-md hover:bg-accent transition-colors text-sidebar-foreground/70 hover:text-sidebar-foreground"
              title="Switch Module"
            >
              <Layers className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Full sidebar ───────────────────────────────────────────────────────────
  return (
    <div
      className="bg-sidebar border-r flex flex-col h-full shadow-sm z-10 shrink-0 overflow-hidden"
      style={{ width }}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b shrink-0 bg-sidebar-accent/30">
        <div className="flex items-center min-w-0">
          <Package className="w-5 h-5 mr-2 text-primary shrink-0" />
          <h2 className="font-bold text-base tracking-tight text-sidebar-foreground truncate">
            {moduleName}
          </h2>
        </div>
        {/* Collapse button */}
        <button
          onClick={onToggleCollapse}
          className="ml-2 p-1.5 rounded-md hover:bg-sidebar-accent transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground shrink-0"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-3 space-y-2">
          {navData.map((section) => (
            <div key={section.title} className="space-y-1">
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors"
                data-testid={`button-sidebar-section-${section.title
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, "-")}`}
              >
                <div className="flex items-center min-w-0">
                  {section.icon}
                  <span className="truncate">{section.title}</span>
                </div>
                {openSections[section.title] ? (
                  <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 opacity-50 shrink-0" />
                )}
              </button>

              {openSections[section.title] && (
                <div className="pl-6 pr-2 py-1 space-y-1">
                  {section.items.map((item) => {
                    const isActive = location === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-3 py-1.5 text-sm rounded-md transition-colors truncate ${
                          isActive
                            ? "bg-primary text-primary-foreground font-medium shadow-sm"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                        data-testid={`link-sidebar-${item.label
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, "-")}`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {isStock && (
            <div className="mt-4 pt-4 border-t">
              <Link
                href="/stock/settings"
                className={`flex items-center px-3 py-2 text-sm font-semibold rounded-md transition-colors ${
                  location === "/stock/settings"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
                data-testid="link-sidebar-settings"
              >
                <Settings className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">Settings</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Switch Module */}
      <div className="p-4 border-t bg-sidebar-accent/10 shrink-0">
        <Link href="/" data-testid="link-sidebar-switch-module">
          <button className="flex w-full items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
            <Layers className="w-4 h-4 mr-2 shrink-0" />
            <span className="truncate">Switch Module</span>
          </button>
        </Link>
      </div>
    </div>
  );
}
