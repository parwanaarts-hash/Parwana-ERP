import { Box, Tag, Layers, Building2, Users } from "lucide-react";
import { DashboardLayout, CardGrid, NavCard } from "@/components/layout/DashboardLayout";

const cards: NavCard[] = [
  {
    label: "Products",
    labelUrdu: "پروڈکٹس",
    description: "Manage product catalogue, types and shikanja assignments.",
    href: "/stock/add/products",
    icon: Box,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    label: "Categories",
    labelUrdu: "زمرے",
    description: "Main and sub categories for product classification.",
    href: "/stock/add/categories",
    icon: Tag,
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
  },
  {
    label: "Shikanja",
    labelUrdu: "شکنجہ",
    description: "Shikanja / frame types linked to products.",
    href: "/stock/add/shikanja",
    icon: Layers,
    iconBg: "bg-cyan-100",
    iconColor: "text-cyan-600",
  },
  {
    label: "Purchase Parties",
    labelUrdu: "خریداری فریقین",
    description: "Suppliers and vendors for purchase transactions.",
    href: "/stock/add/purchase-parties",
    icon: Building2,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  {
    label: "Sale Parties",
    labelUrdu: "فروخت فریقین",
    description: "Customers and buyers for sale transactions.",
    href: "/stock/add/sale-parties",
    icon: Users,
    iconBg: "bg-lime-100",
    iconColor: "text-lime-600",
  },
];

export default function StockAddSectionPage() {
  return (
    <DashboardLayout
      title="Add"
      titleUrdu="اضافہ"
      subtitle="Master data management"
      back={{ href: "/stock", label: "Stock Module" }}
    >
      <CardGrid cards={cards} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5" />
    </DashboardLayout>
  );
}
