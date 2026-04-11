"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import PageLayout from "@/components/PageLayout";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import { User } from "@/types";

export default function AnalyticsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Error getting user:", error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  if (loading) {
    return (
      <PageLayout>
        <div className="min-h-screen p-6 pt-32">
          <div className="animate-pulse">
            <div className="h-8 bg-dark-200 rounded w-64 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-dark-200 rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!user) {
    return (
      <PageLayout>
        <div className="min-h-screen p-6 pt-32">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
            <p className="text-gray-400">You must be logged in to view analytics.</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen p-6 pt-32">
        <AnalyticsDashboard userId={user.id} />
      </div>
    </PageLayout>
  );
}
