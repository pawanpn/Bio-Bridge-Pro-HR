import { type ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface AuthGuardProps {
  children: ReactNode;
  permission?: string;
  redirectTo?: string;
}

export function AuthGuard({ children, permission, redirectTo = "/login" }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate(redirectTo, { replace: true, state: { from: location.pathname } });
    }
  }, [loading, user, navigate, redirectTo, location.pathname]);

  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontSize:"13px", color:"#888" }}>
        Loading…
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

export function PermissionGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return <>{children}</>;
}

export default AuthGuard;
