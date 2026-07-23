import { CreditCard, Wallet } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Payment Paid",
    labelUrdu: "ادائیگی",
    description: "Record payments made to purchase parties.",
    href: "/stock/purchase/payments",
    icon: CreditCard,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    label: "Payment Receive",
    labelUrdu: "وصولی",
    description: "Record payments received from sale parties.",
    href: "/stock/sales/payments",
    icon: Wallet,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
];

export default function ErpPaymentsSectionPage() {
  return (
    <DashboardLayout
      title="Payments"
      titleUrdu="ادائیگیاں"
      subtitle="Select a screen to continue"
      back={{ href: "/erp", label: "ERP Module" }}
    >
      <CardGrid cards={cards} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
