import { ArrowRightLeft, TrendingDown, CreditCard, RotateCcw, BookOpen, FileText, Settings } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Purchase",
    description: "Purchase bills entry and management.",
    href: "/erp/purchase",
    icon: ArrowRightLeft,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  {
    label: "Sales",
    description: "Sales bills entry and management.",
    href: "/erp/sales",
    icon: TrendingDown,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    label: "Payments",
    description: "Payment paid and payment receive entries.",
    href: "/erp/payments",
    icon: CreditCard,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    label: "Return",
    description: "Return bills and return adjustments.",
    href: "/erp/return",
    icon: RotateCcw,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
  },
  {
    label: "Ledgers",
    description: "Purchase party and sale party ledgers.",
    href: "/erp/ledgers",
    icon: BookOpen,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  {
    label: "Reports",
    description: "Purchase, sales, return and payment registers.",
    href: "/erp/reports",
    icon: FileText,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
  {
    label: "Settings",
    description: "ERP configuration and preferences.",
    href: "/erp/settings",
    icon: Settings,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
  },
];

export default function ErpModulePage() {
  return (
    <DashboardLayout
      title="ERP Module"
      subtitle="Select a section to continue"
      back={{ href: "/", label: "Home" }}
    >
      <CardGrid cards={cards} columns="grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
