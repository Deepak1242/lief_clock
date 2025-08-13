"use client";
import { useEffect } from "react";
import { useQuery } from "@apollo/client";
import { ME } from "@/graphql/operations";
import { useRouter } from "next/navigation";
import { Spin, Alert } from "antd";

export default function PostLogin() {
  const router = useRouter();
  const { data, loading, error } = useQuery(ME, { fetchPolicy: "network-only" });

  useEffect(() => {
    if (loading) return;
    if (error) {
      // If errors, just go home
      router.replace("/");
      return;
    }
    const role = data?.me?.role;
    if (role === "ADMIN") router.replace("/admin");
    else router.replace("/worker");
  }, [loading, error, data, router]);

  return (
    <div className="p-6">
      <Spin />
      <Alert className="mt-4" message="Signing you in..." type="info" showIcon />
    </div>
  );
}
