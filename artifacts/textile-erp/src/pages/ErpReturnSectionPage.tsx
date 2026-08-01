import { FileX } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Return Bill",
    description: "Create and manage return bills linked to return gate passes.",
    href: "/stock/returns/bills",
    icon: FileX,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
  },
];

export default function ErpReturnSectionPage() {
  return (
    <DashboardLayout
      title="Return"
      subtitle="Select a screen to continue"
      back={{ href: "/erp", label: "ERP Module" }}
    >
      <CardGrid cards={cards} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
