import { FileCheck } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Sale Gate Pass",
    labelUrdu: "فروخت گیٹ پاس",
    description: "Record outgoing stock with sale gate pass entries.",
    href: "/stock/sales/gate-passes",
    icon: FileCheck,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
];

export default function StockSalesSectionPage() {
  return (
    <DashboardLayout
      title="Sales"
      titleUrdu="فروخت"
      subtitle="Select a screen to continue"
      back={{ href: "/stock", label: "Stock Module" }}
    >
      <CardGrid cards={cards} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
