import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import { useSidebarStore } from "../../store/sidebar";

export default function AppShell() {
  const open = useSidebarStore((s) => s.open);
  const setOpen = useSidebarStore((s) => s.setOpen);
  const location = useLocation();

  // Close sidebar on route change (mobile nav)
  useEffect(() => { setOpen(false); }, [location.pathname, setOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base text-fg-base">
      {/* Mobile header — visible only below lg breakpoint */}
      <header className="mobile-header">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-lg text-fg-muted hover:text-fg-base hover:bg-fg-base/5 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-1.5 select-none">
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center">
            <span className="text-[12px] font-bold text-white">C</span>
          </div>
          <span className="text-sm font-semibold text-fg-base tracking-tight">
            CeTeau<span className="text-accent">|AI</span>
          </span>
        </div>
        <div className="w-8" />
      </header>

      {/* Backdrop overlay for mobile sidebar */}
      {open && (
        <div
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
        />
      )}

      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col overflow-x-hidden overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
