'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { PrincipalModal } from './modals/PrincipalModal';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import type { Organization } from '@/lib/types/orgs';

interface Principal {
  id: string;
  email: string | null;
  phone: string | null;
  full_name?: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  org_id: string;
  is_active: boolean;
  created_at: string;
}

interface PrincipalsSectionProps {
  organizations: Organization[];
  onRefresh?: () => void;
}

export function PrincipalsSection({ organizations, onRefresh }: PrincipalsSectionProps) {
  const { t } = useLanguage();
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [principalToDelete, setPrincipalToDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingPrincipal, setEditingPrincipal] = useState<Principal | undefined>(undefined);

  // Load principals from API
  const loadPrincipals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/principals', { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `Failed with ${res.status}`);
      }

      setPrincipals((json.principals || []).slice(0, 4));
    } catch (e: any) {
      console.error('❌ Error loading principals:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadPrincipals();
  }, [loadPrincipals]);

  const handleCreate = () => {
    setEditingPrincipal(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (principal: Principal) => {
    setEditingPrincipal(principal);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setPrincipalToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      setError(null);

      const method = data.id ? 'PUT' : 'POST';
      const res = await fetch('/api/principals', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      // Close modal and refresh data
      setIsModalOpen(false);
      setEditingPrincipal(undefined);
      await loadPrincipals();
      // Notify parent to refresh dashboard stats
      if (onRefresh) {
        onRefresh();
      }
    } catch (e: any) {
      console.error('❌ Error submitting principal:', e.message);
      setError(e.message);
      throw e; // Re-throw so modal can handle it
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!principalToDelete) return;
    try {
      setIsDeleting(true);
      setError(null);

      const res = await fetch(`/api/principals?id=${encodeURIComponent(principalToDelete)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      // Close modal and refresh data
      setIsDeleteModalOpen(false);
      setPrincipalToDelete(null);
      await loadPrincipals();
      // Notify parent to refresh dashboard stats
      if (onRefresh) {
        onRefresh();
      }
    } catch (e: any) {
      console.error('❌ Error deleting principal:', e.message);
      setError(e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0 }}
      className="lg:col-span-1"
    >
      <div className="bg-white dark:bg-slate-800 rounded-ds-md p-3 sm:p-4 lg:p-ds-md shadow-ds-card border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
          <h3 className="text-ds-small sm:text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">{t.principals}</h3>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-0.5 rounded-ds-md bg-mint-500 text-white px-2 sm:px-3 py-1.5 sm:py-2 text-ds-tiny sm:text-ds-small hover:bg-mint-600 transition-colors w-full sm:w-auto justify-center"
          >
            <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {t.create}
          </button>
        </div>
        <div className="overflow-x-auto h-[280px] rounded-md border border-slate-200 dark:border-slate-700">
          <table className="w-full text-ds-tiny sm:text-sm min-w-[600px]">
            <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="py-2 px-2 sm:pr-3">{t.table_name}</th>
                <th className="py-2 px-2 sm:pr-3 hidden md:table-cell">{t.principal_email}</th>
                <th className="py-2 px-2 sm:pr-3 hidden lg:table-cell">{t.principal_phone}</th>
                <th className="py-2 px-2 sm:pr-3 hidden xl:table-cell">{t.principal_org}</th>
                <th className="py-2 px-2 sm:pr-3 hidden lg:table-cell">{t.principal_status}</th>
                <th className="py-2 px-2 sm:pr-3">{t.table_actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-4 px-2 sm:px-3 text-ds-tiny sm:text-ds-small text-center">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-4 px-2 sm:px-3 text-ds-tiny sm:text-ds-small text-red-600 dark:text-red-400">
                    {error}
                  </td>
                </tr>
              ) : principals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 px-2 sm:px-3 text-ds-tiny sm:text-ds-small">{t.table_no_data}</td>
                </tr>
              ) : (
                principals.map((p) => (
                  <tr key={p.id} className="h-12 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 dark:text-slate-100">
                    <td className="py-2 px-2 sm:pr-3 text-ds-tiny sm:text-ds-small truncate max-w-[120px] sm:max-w-none">
                      {(p as any).name || p.email || '—'}
                    </td>
                    <td className="py-2 px-2 sm:pr-3 text-ds-tiny sm:text-ds-small hidden md:table-cell truncate">{p.email || '—'}</td>
                    <td className="py-2 px-2 sm:pr-3 text-ds-tiny sm:text-ds-small hidden lg:table-cell">{p.phone || '—'}</td>
                    <td className="py-2 px-2 sm:pr-3 text-ds-tiny sm:text-ds-small hidden xl:table-cell truncate">
                      {organizations.find(o => o.id === p.org_id)?.name || p.org_id}
                    </td>
                    <td className="py-2 px-2 sm:pr-3 text-ds-tiny sm:text-ds-small hidden lg:table-cell">{p.is_active ? t.active : t.inactive}</td>
                    <td className="py-2 px-2 sm:pr-3">
                      <div className="flex items-center gap-1 sm:space-x-2">
                        <button
                          onClick={() => handleEdit(p)}
                          className="inline-flex items-center gap-1 rounded-md border px-1.5 sm:px-2 py-1 dark:border-slate-700 dark:hover:bg-slate-700"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="inline-flex items-center gap-1 rounded-md border px-1.5 sm:px-2 py-1 hover:bg-red-50 text-red-600 border-red-300 dark:border-red-700 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PrincipalModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPrincipal(undefined);
        }}
        onSubmit={handleSubmit}
        initialData={editingPrincipal}
        organizations={organizations}
        loading={isSubmitting}
        error={error}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setPrincipalToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={t.delete_principal_title}
        message={t.delete_principal_message}
        loading={isDeleting}
        error={error}
        confirmButtonText={t.confirm_delete}
        cancelButtonText={t.cancel_delete}
      />
    </motion.div>
  );
}
