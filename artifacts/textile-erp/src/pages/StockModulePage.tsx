import { ArrowRightLeft, TrendingDown, RotateCcw, PlusCircle, FileText, Settings } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Purchase",
    labelUrdu: "خریداری",
    description: "Purchase gate passes and purchase entries.",
    href: "/stock/purchase",
    icon: ArrowRightLeft,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  {
    label: "Sales",
    labelUrdu: "فروخت",
    description: "Sale gate passes and sales entries.",
    href: "/stock/sales",
    icon: TrendingDown,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    label: "Return",
    labelUrdu: "واپسی",
    description: "Return gate passes and return entries.",
    href: "/stock/returns",
    icon: RotateCcw,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
  },
  {
    label: "Add",
    labelUrdu: "اضافہ",
    description: "Master data — products, categories, parties.",
    href: "/stock/add",
    icon: PlusCircle,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    label: "Reports",
    labelUrdu: "رپورٹس",
    description: "Stock reports, registers and product ledger.",
    href: "/stock/reports",
    icon: FileText,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
  {
    label: "Settings",
    labelUrdu: "ترتیبات",
    description: "System configuration and preferences.",
    href: "/stock/settings",
    icon: Settings,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
  },
];

export default function StockModulePage() {
  return (
    <DashboardLayout
      title="Stock Module"
      titleUrdu="اسٹاک ماڈیول"
      subtitle="Select a section to continue"
      back={{ href: "/", label: "Home" }}
    >
      <CardGrid cards={cards} columns="grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
