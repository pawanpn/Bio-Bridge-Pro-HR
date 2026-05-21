import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthGuard } from "./components/AuthGuard";
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
const SystemSettings       = lazy(() => import("./pages/SystemSettings").then(m => ({ default: m.SystemSettings })));
const DeviceSettings       = lazy(() => import("./pages/DeviceSettings").then(m => ({ default: m.DeviceSettings })));
const CRMManagement        = lazy(() => import("./pages/CRMManagement").then(m => ({ default: m.CRMManagement })));
const AssetsManagement     = lazy(() => import("./pages/AssetsManagement").then(m => ({ default: m.AssetsManagement })));

function PageSkeleton() {
  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "12px" }}>
      {[180, 120, 240, 90].map((w, i) => (
        <div key={i} style={{ height: "14px", width: `${w}px`, background: "#f0f0f0", borderRadius: "4px" }} />
      ))}
    </div>
  );
}

// Handles redirect after login and blocks logged-in users from /login
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
              <Route path="/login" element={<Login />} />
              <Route path="/"      element={<Navigate to="/dashboard" replace />} />

              <Route path="/dashboard"     element={<AuthGuard><ErrorBoundary scope="Dashboard"><ERPDashboard /></ErrorBoundary></AuthGuard>} />
              <Route path="/employees"     element={<AuthGuard><ErrorBoundary scope="Employees"><EmployeeManagement /></ErrorBoundary></AuthGuard>} />
              <Route path="/employees/:id" element={<AuthGuard><ErrorBoundary scope="Employee"><EmployeeDetail /></ErrorBoundary></AuthGuard>} />
              <Route path="/attendance"    element={<AuthGuard><ErrorBoundary scope="Attendance"><AttendanceManagement /></ErrorBoundary></AuthGuard>} />
              <Route path="/leave"         element={<AuthGuard><ErrorBoundary scope="Leave"><LeaveManagement /></ErrorBoundary></AuthGuard>} />
              <Route path="/payroll"       element={<AuthGuard><ErrorBoundary scope="Payroll"><PayrollManagement /></ErrorBoundary></AuthGuard>} />
              <Route path="/finance"       element={<AuthGuard><ErrorBoundary scope="Finance"><FinanceManagement /></ErrorBoundary></AuthGuard>} />
              <Route path="/inventory"     element={<AuthGuard><ErrorBoundary scope="Inventory"><InventoryManagement /></ErrorBoundary></AuthGuard>} />
              <Route path="/projects"      element={<AuthGuard><ErrorBoundary scope="Projects"><ProjectsManagement /></ErrorBoundary></AuthGuard>} />
              <Route path="/reports"       element={<AuthGuard><ErrorBoundary scope="Reports"><Reports /></ErrorBoundary></AuthGuard>} />
              <Route path="/settings"      element={<AuthGuard><ErrorBoundary scope="Settings"><SystemSettings /></ErrorBoundary></AuthGuard>} />
              <Route path="/devices"       element={<AuthGuard><ErrorBoundary scope="Devices"><DeviceSettings /></ErrorBoundary></AuthGuard>} />
              <Route path="/crm"           element={<AuthGuard><ErrorBoundary scope="CRM"><CRMManagement /></ErrorBoundary></AuthGuard>} />
              <Route path="/assets"        element={<AuthGuard><ErrorBoundary scope="Assets"><AssetsManagement /></ErrorBoundary></AuthGuard>} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
