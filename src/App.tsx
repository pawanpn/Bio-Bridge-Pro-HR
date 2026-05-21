// ============================================================
// Bio-Bridge Pro HR — App.tsx (UPDATED)
// Changes from original:
//  1. Wrapped in AuthProvider (single session source)
//  2. Root ErrorBoundary — no more white-screen crashes
//  3. AuthGuard on every protected route
//  4. Removed direct supabase client imports from routing layer
//  5. Unauthorized page added
// ============================================================

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthGuard } from "./components/AuthGuard";
import MainLayout from "./components/MainLayout";

// ── Pages (lazy-loaded for faster startup) ──────────────────
import { lazy, Suspense } from "react";

const LoginPage          = lazy(() => import("./pages/LoginPage"));
const DashboardPage      = lazy(() => import("./pages/DashboardPage"));
const EmployeesPage      = lazy(() => import("./pages/EmployeesPage"));
const EmployeeDetailPage = lazy(() => import("./pages/EmployeeDetailPage"));
const AttendancePage     = lazy(() => import("./pages/AttendancePage"));
const LeavePage          = lazy(() => import("./pages/LeavePage"));
const PayrollPage        = lazy(() => import("./pages/PayrollPage"));
const FinancePage        = lazy(() => import("./pages/FinancePage"));
const InventoryPage      = lazy(() => import("./pages/InventoryPage"));
const ProjectsPage       = lazy(() => import("./pages/ProjectsPage"));
const DevicesPage        = lazy(() => import("./pages/DevicesPage"));
const ReportsPage        = lazy(() => import("./pages/ReportsPage"));
const SettingsPage       = lazy(() => import("./pages/SettingsPage"));
const AuditPage          = lazy(() => import("./pages/AuditPage"));
const SetupWizardPage    = lazy(() => import("./pages/SetupWizardPage"));
const UnauthorizedPage   = lazy(() => import("./pages/UnauthorizedPage"));

// ── Page loading fallback ───────────────────────────────────
function PageSkeleton() {
  return (
    <div style={{
      padding: "2rem",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}>
      {[180, 120, 240, 90].map((w, i) => (
        <div
          key={i}
          style={{
            height: "14px",
            width: `${w}px`,
            background: "var(--color-background-secondary)",
            borderRadius: "4px",
            animation: "shimmer 1.2s infinite",
          }}
        />
      ))}
      <style>{`
        @keyframes shimmer {
          0%,100% { opacity: 0.5 }
          50%      { opacity: 1 }
        }
      `}</style>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────

export default function App() {
  return (
    // 1. Root error boundary — catches any crash including routing errors
    <ErrorBoundary scope="App">
      {/* 2. Auth context — ALL hooks use this, never supabase directly */}
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>

              {/* ── Public routes ──────────────────────────────── */}
              <Route path="/login"        element={<LoginPage />} />
              <Route path="/setup"        element={<SetupWizardPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="/"             element={<Navigate to="/dashboard" replace />} />

              {/* ── Protected routes — ALL inside AuthGuard ─────── */}
              <Route
                element={
                  <AuthGuard>
                    <ErrorBoundary scope="Layout">
                      <MainLayout />
                    </ErrorBoundary>
                  </AuthGuard>
                }
              >
                {/* Dashboard — any authenticated user */}
                <Route
                  path="/dashboard"
                  element={
                    <ErrorBoundary scope="Dashboard">
                      <DashboardPage />
                    </ErrorBoundary>
                  }
                />

                {/* HR */}
                <Route
                  path="/employees"
                  element={
                    <AuthGuard permission="hr:view_employees">
                      <ErrorBoundary scope="Employees">
                        <EmployeesPage />
                      </ErrorBoundary>
                    </AuthGuard>
                  }
                />
                <Route
                  path="/employees/:id"
                  element={
                    <AuthGuard permission="hr:view_employees">
                      <ErrorBoundary scope="Employee Detail">
                        <EmployeeDetailPage />
                      </ErrorBoundary>
                    </AuthGuard>
                  }
                />

                {/* Attendance */}
                <Route
                  path="/attendance"
                  element={
                    <AuthGuard permission="attendance:view">
                      <ErrorBoundary scope="Attendance">
                        <AttendancePage />
                      </ErrorBoundary>
                    </AuthGuard>
                  }
                />

                {/* Leave */}
                <Route
                  path="/leave"
                  element={
                    <AuthGuard permission="leave:view">
                      <ErrorBoundary scope="Leave">
                        <LeavePage />
                      </ErrorBoundary>
                    </AuthGuard>
                  }
                />

                {/* Payroll — restricted to payroll managers and above */}
                <Route
                  path="/payroll"
                  element={
                    <AuthGuard
                      permission="payroll:view"
                      roles={["SUPER_ADMIN", "ADMIN", "MANAGER"]}
                    >
                      <ErrorBoundary scope="Payroll">
                        <PayrollPage />
                      </ErrorBoundary>
                    </AuthGuard>
                  }
                />

                {/* Finance — admin only */}
                <Route
                  path="/finance"
                  element={
                    <AuthGuard
                      permission="finance:view"
                      roles={["SUPER_ADMIN", "ADMIN"]}
                    >
                      <ErrorBoundary scope="Finance">
                        <FinancePage />
                      </ErrorBoundary>
                    </AuthGuard>
                  }
                />

                {/* Inventory */}
                <Route
                  path="/inventory"
                  element={
                    <AuthGuard permission="inventory:view">
                      <ErrorBoundary scope="Inventory">
                        <InventoryPage />
                      </ErrorBoundary>
                    </AuthGuard>
                  }
                />

                {/* Projects */}
                <Route
                  path="/projects"
                  element={
                    <AuthGuard permission="projects:view">
                      <ErrorBoundary scope="Projects">
                        <ProjectsPage />
                      </ErrorBoundary>
                    </AuthGuard>
                  }
                />

                {/* Devices — admin / supervisor */}
                <Route
                  path="/devices"
                  element={
                    <AuthGuard
                      permission="devices:manage"
                      roles={["SUPER_ADMIN", "ADMIN", "SUPERVISOR"]}
                    >
                      <ErrorBoundary scope="Devices">
                        <DevicesPage />
                      </ErrorBoundary>
                    </AuthGuard>
                  }
                />

                {/* Reports */}
                <Route
                  path="/reports"
                  element={
                    <AuthGuard permission="reports:view">
                      <ErrorBoundary scope="Reports">
                        <ReportsPage />
                      </ErrorBoundary>
                    </AuthGuard>
                  }
                />

                {/* Settings — admin only */}
                <Route
                  path="/settings"
                  element={
                    <AuthGuard
                      permission="settings:manage"
                      roles={["SUPER_ADMIN", "ADMIN"]}
                    >
                      <ErrorBoundary scope="Settings">
                        <SettingsPage />
                      </ErrorBoundary>
                    </AuthGuard>
                  }
                />

                {/* Audit log — super admin only */}
                <Route
                  path="/audit"
                  element={
                    <AuthGuard roles={["SUPER_ADMIN"]}>
                      <ErrorBoundary scope="Audit">
                        <AuditPage />
                      </ErrorBoundary>
                    </AuthGuard>
                  }
                />
              </Route>

              {/* 404 */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />

            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
