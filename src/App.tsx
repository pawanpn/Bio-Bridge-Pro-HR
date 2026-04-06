import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SetupWizard } from './components/SetupWizard';
import { MainLayout } from './layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { DeviceSettings } from './pages/DeviceSettings';
import { SystemSettings } from './pages/SystemSettings';
import { Reports } from './pages/Reports';
import './styles/global.css';

function App() {
  const isSetupComplete = localStorage.getItem('setupComplete') === 'true';

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={isSetupComplete ? <Navigate to="/dashboard" replace /> : <SetupWizard />} 
        />
        <Route path="/" element={<MainLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="device-settings" element={<DeviceSettings />} />
          <Route path="system-settings" element={<SystemSettings />} />
          <Route path="reports" element={<Reports />} />
          {/* Redirect old cloud-settings route */}
          <Route path="cloud-settings" element={<Navigate to="/system-settings" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
