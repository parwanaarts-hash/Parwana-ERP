import { FileX2 } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Return Gate Pass",
    labelUrdu: "واپسی گیٹ پاس",
    description: "Record stock returns with return gate pass entries.",
    href: "/stock/returns/gate-passes",
    icon: FileX2,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
  },
];

export default function StockReturnSectionPage() {
  return (
    <DashboardLayout
      title="Return"
      titleUrdu="واپسی"
      subtitle="Select a screen to continue"
      back={{ href: "/stock", label: "Stock Module" }}
    >
      <CardGrid cards={cards} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
