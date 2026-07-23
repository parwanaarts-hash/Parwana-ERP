import { ArrowRightLeft, TrendingDown, CreditCard, RotateCcw, BookOpen, FileText, Settings } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Purchase",
    labelUrdu: "خریداری",
    description: "Purchase bills entry and management.",
    href: "/erp/purchase",
    icon: ArrowRightLeft,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  {
    label: "Sales",
    labelUrdu: "فروخت",
    description: "Sales bills entry and management.",
    href: "/erp/sales",
    icon: TrendingDown,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    label: "Payments",
    labelUrdu: "ادائیگیاں",
    description: "Payment paid and payment receive entries.",
    href: "/erp/payments",
    icon: CreditCard,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    label: "Return",
    labelUrdu: "واپسی",
    description: "Return bills and return adjustments.",
    href: "/erp/return",
    icon: RotateCcw,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
  },
  {
    label: "Ledgers",
    labelUrdu: "لیجرز",
    description: "Purchase party and sale party ledgers.",
    href: "/erp/ledgers",
    icon: BookOpen,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  {
    label: "Reports",
    labelUrdu: "رپورٹس",
    description: "Purchase, sales, return and payment registers.",
    href: "/erp/reports",
    icon: FileText,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
];

export default function ErpModulePage() {
  return (
    <DashboardLayout
      title="ERP Module"
      titleUrdu="ای آر پی ماڈیول"
      subtitle="Select a section to continue"
      back={{ href: "/", label: "Home" }}
    >
      <CardGrid cards={cards} columns="grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
