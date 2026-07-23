import { ClipboardList, ClipboardCheck, RotateCcw, CreditCard, Wallet } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Purchase Register",
    labelUrdu: "خریداری رجسٹر",
    description: "All purchase bills and summary.",
    icon: ClipboardList,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    comingSoon: true,
  },
  {
    label: "Sales Register",
    labelUrdu: "فروخت رجسٹر",
    description: "All sales bills and summary.",
    icon: ClipboardCheck,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    comingSoon: true,
  },
  {
    label: "Return Register",
    labelUrdu: "واپسی رجسٹر",
    description: "All return bills and summary.",
    icon: RotateCcw,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
    comingSoon: true,
  },
  {
    label: "Payment Paid Register",
    labelUrdu: "ادائیگی رجسٹر",
    description: "All outgoing payments register.",
    icon: CreditCard,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    comingSoon: true,
  },
  {
    label: "Payment Receive Register",
    labelUrdu: "وصولی رجسٹر",
    description: "All incoming payments register.",
    icon: Wallet,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    comingSoon: true,
  },
];

export default function ErpReportsPage() {
  return (
    <DashboardLayout
      title="Reports"
      titleUrdu="رپورٹس"
      subtitle="ERP reports and registers"
      back={{ href: "/erp", label: "ERP Module" }}
    >
      <CardGrid cards={cards} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
