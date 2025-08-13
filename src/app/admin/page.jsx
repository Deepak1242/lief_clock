"use client";
import AdminDashboard from "@/src/components/AdminDashboard";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Spin, Typography, Alert } from "antd";

export default function AdminPage() {
  const { user, isLoading } = useUser();
  if (isLoading) return <Spin />;
  // On server, RBAC enforced by GraphQL; here we just hint.
  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-3">
        <a href="/api/auth/login" className="underline">Login</a>
        <a href="/api/auth/logout" className="underline">Logout</a>
        <a href="/" className="underline">Home</a>
      </div>
      {user ? <AdminDashboard /> : <Alert type="warning" message="Please login as Admin to continue" showIcon />}
    </div>
  );
}
