import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

// AppShell is the top-level frame for every authenticated route. It
// hosts the unified left Sidebar (replacing the previous header +
// sidebar combo from Layout.tsx) and a flex-1 <main> for the routed
// page content via React Router's <Outlet>.
//
// Layout philosophy: pure sidebar — no top header bar. The brand,
// agent-mode tags, and primary nav all live inside the sidebar.
export default function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-base text-fg-base">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-x-hidden overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
