import { format } from "date-fns";
import { Settings, UserCircle } from "lucide-react";

export function Header({ title }: { title: string }) {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b bg-card shrink-0 shadow-sm z-10">
      <h1 className="text-xl font-semibold text-foreground tracking-tight" data-testid="text-page-title">{title}</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground" data-testid="text-current-date">
          {format(new Date(), "EEEE, MMMM do, yyyy")}
        </span>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 w-9" data-testid="button-settings">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </button>
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 w-9" data-testid="button-user-profile">
            <UserCircle className="h-6 w-6 text-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
}
