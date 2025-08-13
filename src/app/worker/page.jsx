"use client";
import WorkerDashboard from "@/src/components/WorkerDashboard";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Alert, Spin } from "antd";

export default function WorkerPage() {
  const { user, isLoading } = useUser();
  if (isLoading) return <Spin />;
  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-3">
        <a href="/api/auth/login" className="underline">Login</a>
        <a href="/api/auth/logout" className="underline">Logout</a>
        <a href="/" className="underline">Home</a>
      </div>
      {user ? <WorkerDashboard /> : <Alert type="warning" message="Please login to continue" showIcon />}    
    </div>
  );
}
