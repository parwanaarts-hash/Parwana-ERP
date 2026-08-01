import { ReactNode, useCallback, useRef, useState } from "react";
import { Sidebar } from "./Sidebar";

const MIN_WIDTH = 150;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 256;

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const dragging = useRef(false);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <Sidebar
        width={sidebarWidth}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      {/* Drag handle — only visible when sidebar is expanded */}
      {!collapsed && (
        <div
          onMouseDown={onDragStart}
          className="w-1.5 shrink-0 cursor-col-resize bg-border/60 hover:bg-primary/50 active:bg-primary transition-colors z-20"
          title="Drag to resize sidebar"
        />
      )}

      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-muted/10">
        {children}
      </main>
    </div>
  );
}
