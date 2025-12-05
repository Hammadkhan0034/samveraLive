'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { X, Save } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';

function toLocalInput(iso: string) {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  } catch {
    return '';
  }
}

export interface AddStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddStoryModal({
  isOpen,
  onClose,
  onSuccess,
}: AddStoryModalProps) {
  const { t } = useLanguage();
  const { user } = useRequireAuth();

  const userMetadata = user?.user_metadata;
  
  // Detect user role
  const roleRaw = String(
    userMetadata?.role || userMetadata?.user_type || userMetadata?.account_type || userMetadata?.type || userMetadata?.activeRole || ''
  ).toLowerCase();
  const isTeacher = /teacher/.test(roleRaw);
  const isGuardian = /guardian|parent/.test(roleRaw);
  const isPrincipal = /principal|admin|head/.test(roleRaw);

  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    class_id: '' as string | null,
    title: '',
    caption: '',
    is_public: false, // Default to false for teachers (class-specific stories)
    expires_at: '' as string,
  });
  const [items, setItems] = useState<Array<{
    type: 'text' | 'image';
    caption?: string;
    url?: string;
    mime_type?: string;
    duration_ms?: number;
    imagePreview?: string; // base64 data URL for preview
    imageFile?: File; // file object for upload
  }>>([]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const loadClasses = useCallback(async () => {
    try {
      let list: Array<{ id: string; name: string }> = [];
      
      if (isTeacher) {
        // For teachers: load only their assigned classes
        const res = await fetch(`/api/teacher-classes?t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.classes) {
          list = Array.isArray(json.classes) ? json.classes.map((c: any) => ({ id: c.id, name: c.name })) : [];
        }
      } else if (isGuardian) {
        // For guardians: load classes from their linked students
        try {
          // Step 1: Get guardian-student relationships
          const relRes = await fetch(`/api/guardian-students?guardianId=${user?.id}&t=${Date.now()}`, { cache: 'no-store' });
          const relJson = await relRes.json();
          const relationships = relJson.relationships || [];
          const studentIds = relationships.map((r: any) => r.student_id).filter(Boolean);
          
          if (studentIds.length > 0) {
            // Step 2: Get students to extract class_ids
            const studentsRes = await fetch(`/api/students?t=${Date.now()}`, { cache: 'no-store' });
            const studentsJson = await studentsRes.json();
            const students = studentsJson.students || [];
            
            // Step 3: Extract unique class IDs and names
            const classMap = new Map<string, string>();
            students
              .filter((s: any) => studentIds.includes(s.id))
              .forEach((s: any) => {
                const classId = s.class_id || s.classes?.id;
                const className = s.classes?.name || 'Unknown Class';
                if (classId && !classMap.has(classId)) {
                  classMap.set(classId, className);
                }
              });
            
            list = Array.from(classMap.entries()).map(([id, name]) => ({ id, name }));
          }
        } catch (guardianError: any) {
          console.error('Error loading guardian classes:', guardianError);
          // Don't throw - just leave list empty
        }
      } else {
        // For principals/admins: load all classes
        const res = await fetch(`/api/classes`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
        list = Array.isArray(json.classes) ? json.classes.map((c: any) => ({ id: c.id, name: c.name })) : [];
      }
      
      setClasses(list);
    } catch (e: any) {
      setError(e.message);
    }
  }, [isTeacher, isGuardian, user?.id]);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({
        class_id: '',
        title: '',
        caption: '',
        is_public: false,
        // default 24h from now
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      setItems([]);
      setError(null);
      loadClasses();
    }
  }, [isOpen, loadClasses]);

  async function uploadImageToStorage(file: File, orgId: string, storyId: string, orderIndex: number): Promise<string> {
    // Generate unique filename
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${storyId}_${orderIndex}_${Date.now()}.${fileExt}`;
    const filePath = `${orgId}/${fileName}`;

    console.log('📤 Uploading image to storage:', {
      bucket: 'story-images',
      filePath,
      fileSize: file.size,
      fileType: file.type
    });

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('story-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Error uploading image:', uploadError);
      console.error('❌ Upload error details:', {
        message: uploadError.message,
        ...('statusCode' in uploadError ? { statusCode: (uploadError as any).statusCode } : {})
      });
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    console.log('✅ Image uploaded successfully:', uploadData);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('story-images')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      console.error('❌ Failed to get public URL for:', filePath);
      throw new Error('Failed to get image URL after upload');
    }

    console.log('✅ Generated public URL:', urlData.publicUrl);
    return urlData.publicUrl;
  }

  async function submit() {
    if (!form.expires_at) {
      setError(t.missing_fields);
      return;
    }

    // Validate that at least one story item is added
    if (!items || items.length === 0) {
      setError(t.no_items_error);
      return;
    }

    // Class selection is optional
    const finalClassId = form.class_id && form.class_id !== '' ? form.class_id : null;

    setSubmitting(true);
    setError(null);
    try {
      // First, create the story to get storyId
      const storyBody = {
        class_id: finalClassId,
        title: form.title || null,
        caption: form.caption || null,
        is_public: isTeacher ? false : form.is_public,
        expires_at: form.expires_at,
        items: [], // Will add items after story is created
      };

      const storyRes = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storyBody),
      });

      const storyJson = await storyRes.json();
      if (!storyRes.ok) {
        throw new Error(storyJson.error || `Failed to create story: ${storyRes.status}`);
      }

      const storyId = storyJson.story?.id;
      if (!storyId) {
        throw new Error('Story was created but no ID returned');
      }

      // Get orgId from story response for image uploads
      const orgId = storyJson.story?.org_id;
      if (!orgId) {
        throw new Error('Story was created but no org_id returned');
      }

      // Process items: upload images to storage and get URLs
      const processedItems = await Promise.all(items.map(async (it, idx) => {
        if (it.type === 'image') {
          // If we have a file to upload, upload it to storage
          if (it.imageFile) {
            try {
              const imageUrl = await uploadImageToStorage(it.imageFile, orgId, storyId, idx);
              return {
                url: imageUrl,
                order_index: idx,
                duration_ms: it.duration_ms || 30000,
                caption: it.caption || null,
                mime_type: it.mime_type || 'image/jpeg',
              };
            } catch (uploadError: any) {
              console.error(`❌ Failed to upload image for item ${idx}:`, uploadError);
              throw new Error(`Failed to upload image: ${uploadError.message}`);
            }
          }
          // If we already have a URL (from previous upload or edit), use it
          if (it.url) {
            return {
              url: it.url,
              order_index: idx,
              duration_ms: it.duration_ms || 30000,
              caption: it.caption || null,
              mime_type: it.mime_type || 'image/jpeg',
            };
          }
          // No file and no URL - skip this item
          return null;
        }
        // Text item
        return {
          url: null,
          order_index: idx,
          duration_ms: it.duration_ms || 30000,
          caption: it.caption || null,
          mime_type: it.mime_type || 'text/plain',
        };
      }));

      // Filter out null items (failed uploads or empty items)
      const validItems = processedItems.filter((it): it is NonNullable<typeof it> => it !== null);

      // Update story with items
      let updateRes: Response;
      try {
        updateRes = await fetch(`/api/stories/${storyId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: validItems }),
        });
      } catch (fetchError: any) {
        // Handle network errors (fetch failed)
        console.error('❌ Network error saving story items:', fetchError);
        throw new Error('Network error. Please check your connection and try again.');
      }

      if (!updateRes.ok) {
        let updateJson: any;
        try {
          updateJson = await updateRes.json();
        } catch {
          throw new Error(`Failed to save story items (${updateRes.status}). Please try again.`);
        }
        throw new Error(updateJson.error || `Failed to add items to story: ${updateRes.status}`);
      }

      // Set flag to trigger refresh on stories pages
      try { 
        if (typeof window !== 'undefined') {
          localStorage.setItem('stories_data_updated', 'true');
        }
      } catch {}
      
      // Dispatch event to refresh stories count in PrincipalDashboard
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('stories-refresh'));
      }
      
      // Call success callback and close modal
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        // Close on outside click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-5xl rounded-ds-lg bg-white dark:bg-slate-800 p-6 shadow-ds-lg max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
              {t.add_story || 'Add Story'}
            </h3>
            <p className="mt-1 text-ds-small text-slate-600 dark:text-slate-400">
              {t.add_story_subtitle || 'Add a new story to your class'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.class_label}</label>
              <select
                value={form.class_id || ''}
                onChange={(e)=>setForm(f=>({...f, class_id: e.target.value}))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">{t.org_wide}</option>
                {classes.length === 0 ? (
                  <option value="" disabled>
                    {isTeacher ? 'Loading your classes...' : isGuardian ? 'Loading your children\'s classes...' : isPrincipal ? 'Loading classes...' : 'No classes available'}
                  </option>
                ) : (
                  classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.expires_label}</label>
              <input
                type="datetime-local"
                value={toLocalInput(form.expires_at)}
                onChange={(e)=>setForm(f=>({...f, expires_at: new Date(e.target.value).toISOString()}))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.title_label}</label>
              <input
                value={form.title}
                onChange={(e)=>setForm(f=>({...f, title: e.target.value}))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder={t.title_ph}
              />
            </div>
            {!isTeacher && (isPrincipal || isGuardian) && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.is_public}</label>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={form.is_public} onChange={(e)=>setForm(f=>({...f, is_public: e.target.checked}))} />
                  <span className="text-sm text-slate-600 dark:text-slate-300">{form.is_public ? t.public_yes : t.public_no}</span>
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.caption_label}</label>
              <textarea
                value={form.caption}
                onChange={(e)=>setForm(f=>({...f, caption: e.target.value}))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder={t.caption_ph}
                rows={3}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.items_label}</label>
            <div className="space-y-2">
              {items.length === 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400">{t.items_empty}</div>
              )}
              {items.map((it, i) => (
                <div key={i} className="rounded-md border border-slate-300 p-3 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <select
                      value={it.type}
                      onChange={(e)=>setItems(prev=>prev.map((x,idx)=> idx===i?{...x, type: e.target.value as any }: x))}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="text">{t.item_type_text}</option>
                      <option value="image">{t.item_type_image}</option>
                    </select>
                    <button
                      className="ml-auto text-xs rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:text-slate-200"
                      onClick={()=>setItems(prev=>prev.filter((_,idx)=>idx!==i))}
                      type="button"
                    >{t.remove}</button>
                  </div>
                  {it.type === 'image' && (
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-600 dark:text-slate-400">{t.choose_file}</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              setItems(prev => prev.map((x, idx) => 
                                idx === i ? {
                                  ...x,
                                  imageFile: file,
                                  imagePreview: reader.result as string,
                                  mime_type: file.type || 'image/jpeg',
                                  duration_ms: x.duration_ms || 30000
                                } : x
                              ));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                      {it.imagePreview && (
                        <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600">
                          <Image src={it.imagePreview} alt="Preview" fill sizes="128px" className="object-cover" />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid gap-2 md:grid-cols-2 mt-2">
                    <input
                      placeholder={t.item_caption_ph}
                      value={it.caption || ''}
                      onChange={(e)=>setItems(prev=>prev.map((x,idx)=> idx===i?{...x, caption: e.target.value }: x))}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <input
                      type="number"
                      placeholder={t.duration_ms_ph}
                      value={it.duration_ms || 30000}
                      onChange={(e)=>setItems(prev=>prev.map((x,idx)=> idx===i?{...x, duration_ms: e.target.value ? parseInt(e.target.value) : 30000 }: x))}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              ))}
              <div>
                <button
                  type="button"
                  onClick={()=>setItems(prev=>[...prev, { type: 'text', caption: '', duration_ms: 30000 }])}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
                >{t.add_text_item}</button>
                <button
                  type="button"
                  onClick={()=>setItems(prev=>[...prev, { type: 'image', mime_type: 'image/jpeg', duration_ms: 30000 }])}
                  className="ml-2 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
                >{t.add_image_item}</button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small text-slate-700 hover:bg-mint-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 px-4 py-2 text-ds-small text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t.creating}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> {t.save}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
