import { type ReactNode, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useProviderAuth } from "../context/ProviderAuthContext";

interface ProviderGuardProps {
  children?: ReactNode;
  redirectTo?: string;
}

export function ProviderGuard({ children, redirectTo = "/provider/login" }: ProviderGuardProps) {
  const { providerUser, loading } = useProviderAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!providerUser) {
      navigate(redirectTo, { replace: true, state: { from: location.pathname } });
    }
  }, [loading, providerUser, navigate, redirectTo, location.pathname]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: "13px", color: "#888" }}>
        Loading...
      </div>
    );
  }

  if (!providerUser) return null;
  return <>{children || <Outlet />}</>;
}
