import { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronLeft, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Card type ─────────────────────────────────────────────────────────────────

export interface NavCard {
  label: string;
  labelUrdu?: string;
  description?: string;
  href?: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  comingSoon?: boolean;
  size?: "lg" | "md"; // lg for top-level module cards
}

// ── Individual card ───────────────────────────────────────────────────────────

function DashCard({
  label, labelUrdu, description, href, icon: Icon,
  iconBg, iconColor, comingSoon, size = "md",
}: NavCard) {
  const isLg = size === "lg";

  const inner = (
    <div
      className={`
        bg-card rounded-xl border-2 shadow-sm transition-all flex flex-col relative
        ${isLg ? "p-8 h-56" : "p-6 h-44"}
        ${comingSoon
          ? "border-transparent opacity-55 cursor-not-allowed"
          : "border-transparent hover:border-primary/40 hover:shadow-md cursor-pointer group"}
      `}
    >
      {/* Icon */}
      <div
        className={`
          ${iconBg} rounded-xl flex items-center justify-center mb-4 flex-shrink-0
          ${isLg ? "w-16 h-16" : "w-11 h-11"}
          ${!comingSoon ? "group-hover:scale-110 transition-transform" : ""}
        `}
      >
        <Icon className={`${isLg ? "h-8 w-8" : "h-5 w-5"} ${iconColor}`} />
      </div>

      {/* Text */}
      <div className="flex-1">
        <h3 className={`font-semibold text-card-foreground leading-tight ${isLg ? "text-xl" : "text-sm"}`}>
          {label}
        </h3>
        {description && (
          <p className={`text-muted-foreground mt-2 leading-snug ${isLg ? "text-sm" : "text-xs"}`}>
            {description}
          </p>
        )}
      </div>

      {/* Coming soon badge */}
      {comingSoon && (
        <span className="absolute top-3 right-3 text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium tracking-wide">
          Soon
        </span>
      )}
    </div>
  );

  if (comingSoon || !href) return <div>{inner}</div>;
  return <Link href={href}>{inner}</Link>;
}

// ── Card grid ─────────────────────────────────────────────────────────────────

interface CardGridProps {
  cards: NavCard[];
  columns?: string;
}

export function CardGrid({ cards, columns = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3" }: CardGridProps) {
  return (
    <div className={`grid ${columns} gap-5`}>
      {cards.map((card) => (
        <DashCard key={card.label} {...card} />
      ))}
    </div>
  );
}

// ── Page layout ───────────────────────────────────────────────────────────────

interface DashboardLayoutProps {
  title: string;
  titleUrdu?: string;
  subtitle?: string;
  back?: { href: string; label: string };
  children: ReactNode;
}

export function DashboardLayout({
  title, titleUrdu, subtitle, back, children,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-muted/20 flex flex-col font-sans">
      {/* Top bar */}
      <div className="bg-background border-b px-6 h-14 flex items-center justify-between shrink-0 shadow-sm">
        <div>
          {back && (
            <Link href={back.href}>
              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" />
                {back.label}
              </button>
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">PARWANA ERP</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-14">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-background border-t px-6 h-10 flex items-center justify-center shrink-0">
        <p className="text-xs text-muted-foreground tracking-wide">
          Designed By <span className="font-semibold text-foreground">MUHAMMAD HUZAIFA</span>
        </p>
      </div>
    </div>
  );
}
