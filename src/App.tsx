import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SetupWizard } from './components/SetupWizard';
import { MainLayout } from './layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { CloudSettings } from './pages/CloudSettings';
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
          <Route path="cloud-settings" element={<CloudSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
