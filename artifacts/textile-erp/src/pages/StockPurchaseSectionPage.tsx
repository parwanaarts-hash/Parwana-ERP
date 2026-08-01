import { FileCheck2 } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Purchase Gate Pass",
    description: "Record incoming stock with gate pass entries.",
    href: "/stock/purchase/gate-passes",
    icon: FileCheck2,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
];

export default function StockPurchaseSectionPage() {
  return (
    <DashboardLayout
      title="Purchase"
      subtitle="Select a screen to continue"
      back={{ href: "/stock", label: "Stock Module" }}
    >
      <CardGrid cards={cards} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
