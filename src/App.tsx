import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AppRoutes } from './routes/AppRoutes';

function AppContent() {
  return <AppRoutes />;
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
