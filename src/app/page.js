"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import CTA from "@/components/landing/CTA";

export default function Home() {
  const router = useRouter();
  const { sessionUser, dbUser, isAdmin, isWorker, isLoading } = useAuth();

  useEffect(() => {
    // Only redirect if we have both session and database user data
    if (!isLoading && sessionUser && dbUser) {
      if (isAdmin) {
        console.log('Redirecting admin user to admin dashboard');
        router.push('/admin');
      } else if (isWorker) {
        console.log('Redirecting worker user to worker dashboard');
        router.push('/worker');
      }
    }
  }, [sessionUser, dbUser, isAdmin, isWorker, isLoading, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page for non-authenticated users
  return (
    <main>
      <Hero />
      <Features />
      <CTA />
    </main>
  );
}
