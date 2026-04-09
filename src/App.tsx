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
import { EmployeeHierarchyTree } from './components/EmployeeHierarchyTree';
import { InventoryManagement } from './pages/InventoryManagement';
import { ProjectsManagement } from './pages/ProjectsManagement';
import { CRMManagement } from './pages/CRMManagement';
import { AssetsManagement } from './pages/AssetsManagement';
import { SystemTools } from './components/SystemTools';

function AppContent() {
  const { user, loading } = useAuth();
  const isSetupComplete = localStorage.getItem('setupComplete') === 'true';

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
        <Route path="employees" element={<EmployeeManagement />} />
        <Route path="employee-hierarchy" element={<EmployeeHierarchyTree />} />
        <Route path="leave-management" element={<LeaveManagement />} />
        <Route path="attendance" element={<AttendanceManagement />} />
        <Route path="payroll" element={<PayrollManagement />} />
        <Route path="finance" element={<FinanceManagement />} />
        <Route path="organization" element={<BranchGateDeviceManagement />} />
        <Route path="device-settings" element={<DeviceSettings />} />
        <Route path="notifications" element={<NotificationSystem />} />
        <Route path="system-settings" element={<DynamicSystemSettings />} />
        <Route path="system-tools" element={<SystemTools />} />
        <Route path="permissions" element={<PermissionManagement />} />
        <Route path="reports" element={<Reports />} />
        <Route path="inventory" element={<InventoryManagement />} />
        <Route path="projects" element={<ProjectsManagement />} />
        <Route path="crm" element={<CRMManagement />} />
        <Route path="assets" element={<AssetsManagement />} />
        <Route path="cloud-settings" element={<Navigate to="/system-settings" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
