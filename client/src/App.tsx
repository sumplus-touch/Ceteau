import { Routes, Route, Navigate, useParams } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import Toaster from "./components/layout/Toaster";
import AuthGate from "./components/AuthGate";
import ChatPage from "./pages/ChatPage";
import ChatsPage from "./pages/ChatsPage";
import FilesPage from "./pages/FilesPage";
import TasksPage from "./pages/TasksPage";
import SkillsPage from "./pages/SkillsPage";
import SettingsPage from "./pages/SettingsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";

// Phase 2: theme is now driven by store/theme.ts (binary light/dark,
// default light). The store module applies the saved value on import,
// so no useEffect is needed here anymore.
import "./store/theme";

/**
 * Backwards-compat re-export for any older code that still imports
 * { applyTheme } from "../App". The new canonical way is to use
 * useThemeStore().setTheme(...) from "../store/theme".
 */
import { useThemeStore } from "./store/theme";
export function applyTheme(theme: string | undefined) {
  if (theme === "light" || theme === "dark") {
    useThemeStore.getState().setTheme(theme);
  }
}

// Phase 2 polish: redirect any legacy /projects/:id URL to the new
// canonical /project/:id (singular) shape, preserving the id param.
function RedirectProjectsToProject() {
  const { id } = useParams();
  return <Navigate to={id ? `/project/${id}` : "/project"} replace />;
}

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/"             element={<ChatPage />} />
          <Route path="/chat/:id"     element={<ChatPage />} />
          <Route path="/chats"        element={<ChatsPage />} />

          {/* Canonical project routes (singular, matches agentflow).
              Phase 3: split into list page (ProjectsPage) and detail
              page (ProjectDetailPage). */}
          <Route path="/project"      element={<ProjectsPage />} />
          <Route path="/project/:id"  element={<ProjectDetailPage />} />

          {/* Legacy aliases — redirect /projects → /project so old
              bookmarks and any leftover links still land correctly. */}
          <Route path="/projects"     element={<Navigate to="/project" replace />} />
          <Route path="/projects/:id" element={<RedirectProjectsToProject />} />

          <Route path="/files"        element={<FilesPage />} />
          {/* Phase 2 design: Scheduled and Task Working both render
              the existing TasksPage. Two URLs, one page. Can split
              into distinct pages later if needed. */}
          <Route path="/schedule"     element={<TasksPage />} />
          <Route path="/tasks"        element={<TasksPage />} />
          <Route path="/skills"       element={<SkillsPage />} />
          <Route path="/settings"     element={<SettingsPage />} />
        </Route>
      </Routes>
      <Toaster />
    </AuthGate>
  );
}
