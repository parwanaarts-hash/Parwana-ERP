import { Package, LayoutGrid, Settings } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Stock Module",
    description: "Gate passes, inventory management, master data and stock reports.",
    href: "/stock",
    icon: Package,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    size: "lg",
  },
  {
    label: "ERP Module",
    description: "Purchase bills, sales bills, payments, accounts and ERP reports.",
    href: "/erp",
    icon: LayoutGrid,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    size: "lg",
  },
  {
    label: "Settings",
    description: "System configuration and preferences.",
    href: "/stock/settings",
    icon: Settings,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    size: "lg",
  },
];

export default function ModuleSelector() {
  return (
    <DashboardLayout
      title="PARWANA ERP System"
      subtitle="Select a module to continue"
    >
      <CardGrid cards={cards} columns="grid-cols-1 sm:grid-cols-3 gap-6" />
    </DashboardLayout>
  );
}
