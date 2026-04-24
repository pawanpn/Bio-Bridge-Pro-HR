import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EnhancedSetupWizard } from './components/EnhancedSetupWizard';
import { MainLayout } from './layout/MainLayout';
import { ERPDashboard } from './pages/ERPDashboard';
import { DeviceSettings } from './pages/DeviceSettings';
import { DynamicSystemSettings } from './pages/DynamicSystemSettings';
import { Reports } from './pages/Reports';
import { LeaveManagement } from './pages/LeaveManagement';
import { EmployeeDetail } from './pages/EmployeeDetail';
import { Login } from './pages/Login';
import { AttendanceManagement } from './pages/AttendanceManagement';
import { NotificationSystem } from './pages/NotificationSystem';
import { BranchGateDeviceManagement } from './pages/BranchGateDeviceManagement';
import { EmployeeManagement } from './pages/EmployeeManagement';
import { PayrollManagement } from './pages/PayrollManagement';
import { FinanceManagement } from './pages/FinanceManagement';
import { PermissionManagement } from './components/PermissionManagement';
import { PermissionGuard } from './components/PermissionGuard';
import { ModuleGuard } from './components/ModuleGuard';
import { EmployeeHierarchyTree } from './components/EmployeeHierarchyTree';
import { InventoryManagement } from './pages/InventoryManagement';
import { ProjectsManagement } from './pages/ProjectsManagement';
import { CRMManagement } from './pages/CRMManagement';
import { AssetsManagement } from './pages/AssetsManagement';
import { SystemTools } from './components/SystemTools';
import { AppErrorBoundary } from './components/AppErrorBoundary';

function AppContent() {
  const { user, loading } = useAuth();
  const isSetupComplete = (() => {
    try {
      return localStorage.getItem('setupComplete') === 'true';
    } catch {
      return false;
    }
  })();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSetupComplete) {
    return <EnhancedSetupWizard />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/" element={<MainLayout />}>
        <Route path="dashboard" element={<ERPDashboard />} />
        <Route path="employee/:employeeId" element={<EmployeeDetail />} />
        <Route path="employees" element={<ModuleGuard requiredModule="employees"><EmployeeManagement /></ModuleGuard>} />
        <Route path="employee-hierarchy" element={<ModuleGuard requiredModule="employees"><EmployeeHierarchyTree /></ModuleGuard>} />
        <Route
          path="leave-management"
          element={
            <ModuleGuard requiredModule="leave">
              {isSuperAdmin ? (
                <LeaveManagement />
              ) : (
                <PermissionGuard requiredPermission={['view_leaves', 'apply_leave', 'approve_leave']} showAccessDenied>
                  <LeaveManagement />
                </PermissionGuard>
              )}
            </ModuleGuard>
          }
        />
        <Route path="attendance" element={<ModuleGuard requiredModule="attendance"><AttendanceManagement /></ModuleGuard>} />
        <Route path="payroll" element={<ModuleGuard requiredModule="payroll"><PayrollManagement /></ModuleGuard>} />
        <Route path="finance" element={<ModuleGuard requiredModule="finance"><FinanceManagement /></ModuleGuard>} />
        <Route path="organization" element={<ModuleGuard requiredModule="organization"><BranchGateDeviceManagement /></ModuleGuard>} />
        <Route path="device-settings" element={<ModuleGuard requiredModule="organization"><DeviceSettings /></ModuleGuard>} />
        <Route path="notifications" element={<ModuleGuard requiredModule="notifications"><NotificationSystem /></ModuleGuard>} />
        <Route path="system-settings" element={<ModuleGuard requiredModule="system-settings"><DynamicSystemSettings /></ModuleGuard>} />
        <Route path="system-tools" element={<ModuleGuard requiredModule="system-tools"><SystemTools /></ModuleGuard>} />
        <Route path="permissions" element={<ModuleGuard requiredModule="permissions"><PermissionManagement /></ModuleGuard>} />
        <Route path="reports" element={<ModuleGuard requiredModule="reports"><Reports /></ModuleGuard>} />
        <Route path="inventory" element={<ModuleGuard requiredModule="inventory"><InventoryManagement /></ModuleGuard>} />
        <Route path="projects" element={<ModuleGuard requiredModule="projects"><ProjectsManagement /></ModuleGuard>} />
        <Route path="crm" element={<ModuleGuard requiredModule="crm"><CRMManagement /></ModuleGuard>} />
        <Route path="assets" element={<ModuleGuard requiredModule="assets"><AssetsManagement /></ModuleGuard>} />
        <Route path="cloud-settings" element={<Navigate to="/system-settings" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
