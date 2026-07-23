import { BookOpen, BookUser, BookKey } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Party Ledger",
    labelUrdu: "فریق لیجر",
    description: "Combined ledger view for all parties.",
    icon: BookOpen,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    comingSoon: true,
  },
  {
    label: "Customer Ledger",
    labelUrdu: "گاہک لیجر",
    description: "Statement of accounts for sale parties.",
    icon: BookUser,
    iconBg: "bg-lime-100",
    iconColor: "text-lime-600",
    comingSoon: true,
  },
  {
    label: "Supplier Ledger",
    labelUrdu: "سپلائر لیجر",
    description: "Statement of accounts for purchase parties.",
    icon: BookKey,
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
    comingSoon: true,
  },
];

export default function ErpAccountsSectionPage() {
  return (
    <DashboardLayout
      title="Accounts"
      titleUrdu="حسابات"
      subtitle="Party, customer and supplier ledgers"
      back={{ href: "/erp", label: "ERP Module" }}
    >
      <CardGrid cards={cards} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
