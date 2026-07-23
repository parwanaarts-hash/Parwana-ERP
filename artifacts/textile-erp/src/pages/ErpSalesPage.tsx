import { FileText, Wallet } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Sales Bill",
    labelUrdu: "فروخت بل",
    description: "Create and manage sales bills linked to gate passes.",
    href: "/stock/sales/bills",
    icon: FileText,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    label: "Payment Receive",
    labelUrdu: "وصولی",
    description: "Record payments received from sale parties.",
    href: "/stock/sales/payments",
    icon: Wallet,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
];

export default function ErpSalesPage() {
  return (
    <DashboardLayout
      title="Sales"
      titleUrdu="فروخت"
      subtitle="Select a screen to continue"
      back={{ href: "/erp", label: "ERP Module" }}
    >
      <CardGrid cards={cards} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
