import { Building2, Users } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Purchase Party Ledger",
    description: "Statement of accounts for purchase parties / suppliers.",
    icon: Building2,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    comingSoon: true,
  },
  {
    label: "Sale Party Ledger",
    description: "Statement of accounts for sale parties / customers.",
    icon: Users,
    iconBg: "bg-lime-100",
    iconColor: "text-lime-600",
    comingSoon: true,
  },
];

export default function ErpAccountsSectionPage() {
  return (
    <DashboardLayout
      title="Ledgers"
      subtitle="Party account statements"
      back={{ href: "/erp", label: "ERP Module" }}
    >
      <CardGrid cards={cards} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
