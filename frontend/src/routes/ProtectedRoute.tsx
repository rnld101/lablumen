import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";

/** Gate for authenticated routes.
 * `staffOnly` requires a staff group (redirects patients to `/`).
 * `patientOnly` blocks staff (redirects them to `/staff`).
 */
export function ProtectedRoute({
  staffOnly = false,
  patientOnly = false,
}: {
  staffOnly?: boolean;
  patientOnly?: boolean;
}) {
  const { claims, isStaff } = useAuth();
  if (!claims) return <Navigate to="/login" replace />;
  if (staffOnly && !isStaff) return <Navigate to="/" replace />;
  if (patientOnly && isStaff) return <Navigate to="/staff" replace />;
  return <Outlet />;
}
