'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type Lang = 'is' | 'en';

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

export default function EditStoryPage() {
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const { user } = useRequireAuth();
  const router = useRouter();
  const params = useParams();
  const storyId = params?.storyId as string;

  const userMetadata = user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const userId = user?.id;
  
  // Detect if user is a teacher
  const roleRaw = String(
    userMetadata?.role || userMetadata?.user_type || userMetadata?.account_type || userMetadata?.type || userMetadata?.activeRole || ''
  ).toLowerCase();
  const isTeacher = /teacher/.test(roleRaw);

  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    org_id: '',
    class_id: '' as string | null,
    title: '',
    caption: '',
    is_public: false,
    expires_at: '' as string,
  });
  const [items, setItems] = useState<Array<{
    type: 'text' | 'image';
    caption?: string;
    url?: string;
    mime_type?: string;
    duration_ms?: number;
    imagePreview?: string; // base64 data URL for preview or existing image URL
    imageFile?: File; // file object for upload (only if new file selected)
  }>>([]);

  // Load story data on mount
  useEffect(() => {
    if (!storyId || !orgId || !userId) return;
    loadStory();
    loadClasses();
  }, [storyId, orgId, userId]);

  async function loadStory() {
    if (!storyId || !userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/stories/${storyId}?authorId=${userId}&orgId=${orgId}`, { cache: 'no-store' });
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || `Failed to load story: ${res.status}`);
      }
      
      const story = json.story;
      const storyItems = Array.isArray(json.items) ? json.items : [];
      
      // Auto-fill form
      setForm({
        org_id: story.org_id || orgId || '',
        class_id: story.class_id || null,
        title: story.title || '',
        caption: story.caption || '',
        is_public: story.is_public || false,
        expires_at: story.expires_at || '',
      });
      
      // Load items
      const loadedItems = storyItems.map((item: any) => {
        const isImage = item.mime_type && item.mime_type.startsWith('image/');
        return {
          type: isImage ? 'image' as const : 'text' as const,
          caption: item.caption || '',
          url: item.url || undefined,
          mime_type: item.mime_type || undefined,
          duration_ms: item.duration_ms || 30000,
          imagePreview: item.url || undefined, // Use existing URL as preview
        };
      });
      
      setItems(loadedItems);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadClasses() {
    try {
      let list: Array<{ id: string; name: string }> = [];
      
      if (isTeacher && userId) {
        // For teachers: load only their assigned classes
        const res = await fetch(`/api/teacher-classes?userId=${userId}&t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.classes) {
          list = Array.isArray(json.classes) ? json.classes.map((c: any) => ({ id: c.id, name: c.name })) : [];
        }
      } else {
        // For principals/admins: load all classes
        const res = await fetch(`/api/classes?orgId=${orgId}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
        list = Array.isArray(json.classes) ? json.classes.map((c: any) => ({ id: c.id, name: c.name })) : [];
      }
      
      setClasses(list);
    } catch (e: any) {
      // Ignore class loading errors
    }
  }

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
    if (!orgId || !form.expires_at || !storyId || !userId) {
      setError(t.missing_fields);
      return;
    }

    // Validate that at least one story item is added
    if (!items || items.length === 0) {
      setError(t.no_items_error);
      return;
    }

    // For teachers: ensure class_id is set
    const finalClassId = form.class_id && form.class_id !== '' ? form.class_id : null;
    
    // Teachers must select a class
    if (isTeacher && !finalClassId) {
      setError('Please select a class for your story');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // First, update the story metadata
      const storyBody = {
        org_id: orgId,
        class_id: finalClassId,
        author_id: userId,
        title: form.title || null,
        caption: form.caption || null,
        is_public: isTeacher ? false : form.is_public,
        expires_at: form.expires_at,
      };

      const storyRes = await fetch(`/api/stories?id=${storyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storyBody),
      });

      const storyJson = await storyRes.json();
      if (!storyRes.ok) {
        throw new Error(storyJson.error || `Failed to update story: ${storyRes.status}`);
      }

      // Delete old items
      const deleteRes = await fetch(`/api/stories/${storyId}/items`, {
        method: 'DELETE',
      });

      if (!deleteRes.ok) {
        const deleteJson = await deleteRes.json();
        console.warn('⚠️ Failed to delete old items:', deleteJson.error);
        // Continue anyway - we'll insert new items
      }

      // Process items: upload new images to storage and get URLs
      const processedItems = await Promise.all(items.map(async (it, idx) => {
        if (it.type === 'image') {
          // If we have a new file to upload, upload it to storage
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
          // If we already have a URL (existing image), use it
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

      // Insert new items
      if (validItems.length > 0) {
        const updateRes = await fetch(`/api/stories/${storyId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: validItems }),
        });

        if (!updateRes.ok) {
          const updateJson = await updateRes.json();
          throw new Error(updateJson.error || `Failed to update story items: ${updateRes.status}`);
        }
      }
      
      try { if (typeof window !== 'undefined') localStorage.setItem('stories_data_updated', 'true'); } catch {}
      
      // Dispatch event to refresh stories count in PrincipalDashboard
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('stories-refresh'));
      }
      
      router.push('/dashboard/stories');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 mt-10">
          <div className="text-slate-600 dark:text-slate-400">{t.loading || 'Loading...'}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <main className="mx-auto max-w-4xl px-4 py-8 md:px-6 mt-10 ml-20">
          <div className="mb-6 flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.subtitle}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.class_label} {isTeacher && '*'}</label>
                <select
                  value={form.class_id || ''}
                  onChange={(e)=>setForm(f=>({...f, class_id: e.target.value}))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  required={isTeacher}
                >
                  {!isTeacher && <option value="">{t.org_wide}</option>}
                  {classes.length === 0 ? (
                    <option value="" disabled>{isTeacher ? 'Loading your classes...' : 'No classes available'}</option>
                  ) : (
                    classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))
                  )}
                </select>
                {isTeacher && !form.class_id && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Please select a class for your story</p>
                )}
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
              {!isTeacher && (
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

            <div className="mt-6">
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
                        {(it.imagePreview || it.url) && (
                          <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600">
                            <Image src={it.imagePreview || it.url || ''} alt="Preview" fill sizes="128px" className="object-cover" />
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

            <div className="mt-6 flex items-center justify-end gap-2">
              <button 
                className="rounded-md px-4 py-2 text-sm text-slate-700 hover:underline dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={()=>router.push('/dashboard/stories')}
                disabled={submitting}
              >
                {t.cancel}
              </button>
              <button 
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60 disabled:cursor-not-allowed dark:bg-slate-100 dark:text-slate-900" 
                disabled={submitting} 
                onClick={submit}
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white dark:text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t.updating}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> {t.save}
                  </>
                )}
              </button>
            </div>
          </div>
      </main>
    </div>
  );
}

const enText = {
  title: 'Edit Story',
  subtitle: 'Update your story with optional text and images.',
  back: 'Back',
  loading: 'Loading story...',
  class_label: 'Class',
  org_wide: 'Organization-wide',
  title_label: 'Title',
  title_ph: 'Optional title',
  caption_label: 'Caption',
  caption_ph: 'Optional caption',
  is_public: 'Public',
  public_yes: 'Yes',
  public_no: 'No',
  expires_label: 'Expires at',
  items_label: 'Story items',
  items_empty: 'No items yet. Add text or image items.',
  add_text_item: 'Add text item',
  add_image_item: 'Add image item',
  remove: 'Remove',
  item_caption_ph: 'Item caption (optional)',
  duration_ms_ph: 'Duration (ms, optional)',
  image_data_ph: 'Image data (base64)',
  mime_type_ph: 'MIME type e.g. image/jpeg',
  item_type_text: 'Text',
  item_type_image: 'Image',
  save: 'Save',
  updating: 'Updating...',
  cancel: 'Cancel',
  missing_fields: 'Missing required fields',
  no_items_error: 'Please add at least one story item (text or image) before updating the story.',
  choose_file: 'Choose Image File',
};

const isText = {
  title: 'Breyta sögu',
  subtitle: 'Uppfærðu söguna með texta og/eða myndum.',
  back: 'Til baka',
  loading: 'Hleður sögu...',
  class_label: 'Hópur',
  org_wide: 'Stofnunarvítt',
  title_label: 'Titill',
  title_ph: 'Valfrjáls titill',
  caption_label: 'Lýsing',
  caption_ph: 'Valfrjáls lýsing',
  is_public: 'Opinber',
  public_yes: 'Já',
  public_no: 'Nei',
  expires_label: 'Rennur út',
  items_label: 'Atriði sögunnar',
  items_empty: 'Engin atriði enn. Bættu við texta eða mynd.',
  add_text_item: 'Bæta við textaatriði',
  add_image_item: 'Bæta við myndaatriði',
  remove: 'Fjarlægja',
  item_caption_ph: 'Lýsing atriðis (valfrjálst)',
  duration_ms_ph: 'Lengd (ms, valfrjálst)',
  upload_id_ph: 'Upload ID (fyrir mynd)',
  mime_type_ph: 'MIME gerð t.d. image/jpeg',
  item_type_text: 'Texti',
  item_type_image: 'Mynd',
  save: 'Vista',
  updating: 'Uppfærir...',
  cancel: 'Hætta við',
  missing_fields: 'Vantar nauðsynleg svæði',
  no_items_error: 'Vinsamlegast bættu við að minnsta kosti einu atriði sögunnar (texta eða mynd) áður en þú uppfærir söguna.',
  choose_file: 'Veldu myndaskrá',
};

