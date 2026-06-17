import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";

/** Gate for authenticated routes. `staffOnly` additionally requires a staff group. */
export function ProtectedRoute({ staffOnly = false }: { staffOnly?: boolean }) {
  const { claims, isStaff } = useAuth();
  if (!claims) return <Navigate to="/login" replace />;
  if (staffOnly && !isStaff) return <Navigate to="/" replace />;
  return <Outlet />;
}
