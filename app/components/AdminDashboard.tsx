'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { AdminStatsCards } from './admin/AdminStatsCards';
import { OrganizationsSection } from './admin/OrganizationsSection';
import { PrincipalsSection } from './admin/PrincipalsSection';
import { SystemStatus } from './admin/SystemStatus';
import { AdminDashboardSkeleton } from './admin/AdminDashboardSkeleton';
import type { Organization } from '@/lib/types/orgs';

interface AdminStats {
  totalUsers: number;
  totalTeachers: number;
  totalStudents: number;
  totalParents: number;
  activeUsers: number;
  newRegistrations: number;
}

export function AdminDashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalTeachers: 0,
    totalStudents: 0,
    totalParents: 0,
    activeUsers: 0,
    newRegistrations: 0,
  });
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load dashboard data from single API endpoint
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Loading admin dashboard data from API...');
      
      const res = await fetch('/api/admin-dashboard', { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `Failed with ${res.status}`);
      }

      console.log('📥 Admin dashboard API response:', {
        stats: json.stats,
        orgs: json.orgs?.length || 0,
        principals: json.principals?.length || 0,
        teachers: json.teachers?.length || 0,
        guardians: json.guardians?.length || 0,
        students: json.students?.length || 0
      });

      // Update stats and orgs (for passing to PrincipalsSection)
      setStats(json.stats || {
        totalUsers: 0,
        totalTeachers: 0,
        totalStudents: 0,
        totalParents: 0,
        activeUsers: 0,
        newRegistrations: 0,
      });
      setOrgs(json.orgs || []);

      console.log('✅ Admin dashboard data loaded successfully');
    } catch (e: any) {
      console.error('❌ Error loading admin dashboard data:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Show skeleton while loading
  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500 mt-4 sm:mt-6 lg:mt-10 px-3 sm:px-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0 }}
        className="mb-4 sm:mb-6 lg:mb-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-ds-h2 sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1 sm:mb-2">
              {t.adminDashboard}
            </h1>
            <p className="text-ds-tiny sm:text-ds-small text-slate-600 dark:text-slate-400">
              {t.manageUsersSchools}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="hidden sm:block">
              <p className="text-ds-tiny sm:text-ds-small font-medium text-slate-900 dark:text-slate-100">{t.adminAccess}</p>
              <p className="text-ds-tiny text-slate-500 dark:text-slate-400">{t.fullPermissions}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Error State */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-ds-md">
          <p className="text-ds-small text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <AdminStatsCards stats={stats} />

      {/* Organizations and Principals Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-ds-md">
        <OrganizationsSection />
        <PrincipalsSection organizations={orgs} onRefresh={loadDashboardData} />
      </div>

      {/* System Status */}
      <SystemStatus />
    </div>
  );
}
