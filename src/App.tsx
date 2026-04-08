import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SetupWizard } from './components/SetupWizard';
import { MainLayout } from './layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { DeviceSettings } from './pages/DeviceSettings';
import { SystemSettings } from './pages/SystemSettings';
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

function AppContent() {
  const { user } = useAuth();
  const isSetupComplete = localStorage.getItem('setupComplete') === 'true';

  if (!isSetupComplete) {
    return <SetupWizard />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/" element={<MainLayout />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="employee/:employeeId" element={<EmployeeDetail />} />
        <Route path="employees" element={<EmployeeManagement />} />
        <Route path="leave-management" element={<LeaveManagement />} />
        <Route path="attendance" element={<AttendanceManagement />} />
        <Route path="payroll" element={<PayrollManagement />} />
        <Route path="finance" element={<FinanceManagement />} />
        <Route path="organization" element={<BranchGateDeviceManagement />} />
        <Route path="device-settings" element={<DeviceSettings />} />
        <Route path="notifications" element={<NotificationSystem />} />
        <Route path="system-settings" element={<SystemSettings />} />
        <Route path="reports" element={<Reports />} />
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
