import { LogOut } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-bento px-3 py-2 text-sm font-medium transition-colors",
    isActive ? "bg-primary text-white" : "text-text-muted hover:bg-surface",
  );

export function Layout() {
  const { claims, isStaff, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold text-primary">LabLumen</span>
          <nav className="flex items-center gap-2">
            <NavLink to="/" className={linkClass} end>
              Patient
            </NavLink>
            {isStaff && (
              <NavLink to="/staff" className={linkClass}>
                Staff
              </NavLink>
            )}
            <span className="ml-2 hidden text-xs text-text-muted sm:inline">{claims?.email}</span>
            <Button size="sm" variant="ghost" onClick={onLogout} aria-label="Sign out">
              <LogOut className="mr-1 h-4 w-4" />
              Sign out
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
