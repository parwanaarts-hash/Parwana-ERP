import { List, BookOpen, ClipboardList, ClipboardCheck, RotateCcw } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Stock List",
    labelUrdu: "اسٹاک فہرست",
    description: "Current stock levels and inventory summary.",
    href: "/stock/reports/stock",
    icon: List,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
  {
    label: "Product Ledger",
    labelUrdu: "پروڈکٹ لیجر",
    description: "Movement history for individual products.",
    href: "/stock/reports/product-ledger",
    icon: BookOpen,
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
  },
  {
    label: "Purchase Gate Pass Register",
    labelUrdu: "خریداری گیٹ پاس رجسٹر",
    description: "All purchase gate pass records and summary.",
    href: "/stock/reports/purchase",
    icon: ClipboardList,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  {
    label: "Sale Gate Pass Register",
    labelUrdu: "فروخت گیٹ پاس رجسٹر",
    description: "All sale gate pass records and summary.",
    href: "/stock/reports/sales",
    icon: ClipboardCheck,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    label: "Return Gate Pass Register",
    labelUrdu: "واپسی گیٹ پاس رجسٹر",
    description: "All return gate pass records and summary.",
    href: "/stock/reports/returns",
    icon: RotateCcw,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
  },
];

export default function StockReportsSectionPage() {
  return (
    <DashboardLayout
      title="Reports"
      titleUrdu="رپورٹس"
      subtitle="Stock reports and registers"
      back={{ href: "/stock", label: "Stock Module" }}
    >
      <CardGrid cards={cards} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
