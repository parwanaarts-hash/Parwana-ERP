import { Receipt } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Purchase Bill",
    description: "Create and manage purchase bills linked to gate passes.",
    href: "/stock/purchase/bills",
    icon: Receipt,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
];

export default function ErpPurchasePage() {
  return (
    <DashboardLayout
      title="Purchase"
      subtitle="Select a screen to continue"
      back={{ href: "/erp", label: "ERP Module" }}
    >
      <CardGrid cards={cards} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
