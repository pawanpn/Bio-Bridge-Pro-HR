import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthGuard } from "./components/AuthGuard";
import { MainLayout } from "./layout/MainLayout";
import { lazy, Suspense, useEffect } from "react";

const Login                = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const ERPDashboard         = lazy(() => import("./pages/ERPDashboard").then(m => ({ default: m.ERPDashboard })));
const EmployeeManagement   = lazy(() => import("./pages/EmployeeManagement").then(m => ({ default: m.EmployeeManagement })));
const EmployeeDetail       = lazy(() => import("./pages/EmployeeDetail").then(m => ({ default: m.EmployeeDetail })));
const AttendanceManagement = lazy(() => import("./pages/AttendanceManagement").then(m => ({ default: m.AttendanceManagement })));
const LeaveManagement      = lazy(() => import("./pages/LeaveManagement").then(m => ({ default: m.LeaveManagement })));
const PayrollManagement    = lazy(() => import("./pages/PayrollManagement").then(m => ({ default: m.PayrollManagement })));
const FinanceManagement    = lazy(() => import("./pages/FinanceManagement").then(m => ({ default: m.FinanceManagement })));
const InventoryManagement  = lazy(() => import("./pages/InventoryManagement").then(m => ({ default: m.InventoryManagement })));
const ProjectsManagement   = lazy(() => import("./pages/ProjectsManagement").then(m => ({ default: m.ProjectsManagement })));
const Reports              = lazy(() => import("./pages/Reports").then(m => ({ default: m.Reports })));
const SystemSettings              = lazy(() => import("./pages/SystemSettings").then(m => ({ default: m.SystemSettings })));
const DeviceSettings              = lazy(() => import("./pages/DeviceSettings").then(m => ({ default: m.DeviceSettings })));
const CRMManagement               = lazy(() => import("./pages/CRMManagement").then(m => ({ default: m.CRMManagement })));
const AssetsManagement            = lazy(() => import("./pages/AssetsManagement").then(m => ({ default: m.AssetsManagement })));
const NotificationSystem          = lazy(() => import("./pages/NotificationSystem").then(m => ({ default: m.NotificationSystem })));
const BranchGateDeviceManagement  = lazy(() => import("./pages/BranchGateDeviceManagement").then(m => ({ default: m.BranchGateDeviceManagement })));
const PermissionManagement        = lazy(() => import("./components/PermissionManagement").then(m => ({ default: m.PermissionManagement })));
const SystemToolsComponent        = lazy(() => import("./components/SystemTools").then(m => ({ default: m.SystemTools })));

function PageSkeleton() {
  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "12px" }}>
      {[180, 120, 240, 90].map((w, i) => (
        <div key={i} style={{ height: "14px", width: `${w}px`, background: "#f0f0f0", borderRadius: "4px" }} />
      ))}
    </div>
  );
}

function AuthRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (user && location.pathname === "/login") {
      const from = (location.state as any)?.from || "/dashboard";
      navigate(from, { replace: true });
    }
  }, [user, loading, location.pathname, navigate, location.state]);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary scope="App">
      <AuthProvider>
        <BrowserRouter>
          <AuthRedirect />
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Protected � all inside MainLayout which has the sidebar */}
              <Route element={
                <AuthGuard>
                  <ErrorBoundary scope="Layout">
                    <MainLayout />
                  </ErrorBoundary>
                </AuthGuard>
              }>
                <Route path="/dashboard"     element={<ErrorBoundary scope="Dashboard"><ERPDashboard /></ErrorBoundary>} />
                <Route path="/employees"     element={<ErrorBoundary scope="Employees"><EmployeeManagement /></ErrorBoundary>} />
                <Route path="/employees/:id" element={<ErrorBoundary scope="Employee"><EmployeeDetail /></ErrorBoundary>} />
                <Route path="/attendance"    element={<ErrorBoundary scope="Attendance"><AttendanceManagement /></ErrorBoundary>} />
                <Route path="/leave"         element={<ErrorBoundary scope="Leave"><LeaveManagement /></ErrorBoundary>} />
                <Route path="/payroll"       element={<ErrorBoundary scope="Payroll"><PayrollManagement /></ErrorBoundary>} />
                <Route path="/finance"       element={<ErrorBoundary scope="Finance"><FinanceManagement /></ErrorBoundary>} />
                <Route path="/inventory"     element={<ErrorBoundary scope="Inventory"><InventoryManagement /></ErrorBoundary>} />
                <Route path="/projects"      element={<ErrorBoundary scope="Projects"><ProjectsManagement /></ErrorBoundary>} />
                <Route path="/reports"       element={<ErrorBoundary scope="Reports"><Reports /></ErrorBoundary>} />
                <Route path="/settings"      element={<ErrorBoundary scope="Settings"><SystemSettings /></ErrorBoundary>} />
                <Route path="/devices"       element={<ErrorBoundary scope="Devices"><DeviceSettings /></ErrorBoundary>} />
                <Route path="/organization"  element={<ErrorBoundary scope="Organization"><BranchGateDeviceManagement /></ErrorBoundary>} />
                <Route path="/permissions"   element={<ErrorBoundary scope="Permissions"><PermissionManagement /></ErrorBoundary>} />
                <Route path="/system-tools"  element={<ErrorBoundary scope="SystemTools"><SystemToolsComponent /></ErrorBoundary>} />
                <Route path="/crm"           element={<ErrorBoundary scope="CRM"><CRMManagement /></ErrorBoundary>} />
                <Route path="/assets"        element={<ErrorBoundary scope="Assets"><AssetsManagement /></ErrorBoundary>} />
                <Route path="/notifications" element={<ErrorBoundary scope="Notifications"><NotificationSystem /></ErrorBoundary>} />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
