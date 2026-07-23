import { ChevronRight, Home } from "lucide-react";
import { Link } from "wouter";

export function Breadcrumb({ items }: { items: string[] }) {
  return (
    <nav className="flex items-center text-sm text-muted-foreground" data-testid="nav-breadcrumb">
      <Link href="/" className="hover:text-foreground transition-colors flex items-center" data-testid="link-breadcrumb-home">
        <Home className="h-4 w-4" />
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          <ChevronRight className="h-4 w-4 mx-1 opacity-50" />
          <span className={index === items.length - 1 ? "text-foreground font-medium" : ""} data-testid={`text-breadcrumb-${index}`}>
            {item}
          </span>
        </div>
      ))}
    </nav>
  );
}
