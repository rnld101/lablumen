import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { AuthProvider } from "@/lib/AuthContext";
import { queryClient } from "@/lib/queryClient";
import { Layout } from "@/routes/Layout";
import { Login } from "@/routes/Login";
import { PatientDashboard } from "@/routes/PatientDashboard";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { StaffDashboard } from "@/routes/StaffDashboard";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <Layout />,
        children: [{ index: true, element: <PatientDashboard /> }],
      },
      {
        element: <ProtectedRoute staffOnly />,
        children: [
          {
            path: "/staff",
            element: <Layout />,
            children: [{ index: true, element: <StaffDashboard /> }],
          },
        ],
      },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
