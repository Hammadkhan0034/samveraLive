-- Supabase Storage Bucket Setup for Story Images
-- Run this in Supabase SQL Editor to create the storage bucket and RLS policies
--
-- IMPORTANT: Before running this script:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create a new bucket named "story-images"
-- 3. Set it to PUBLIC (for easy image access)
-- 4. Then run this SQL script to set up the RLS policies

-- Create the storage bucket via SQL (if your Supabase version supports it)
-- If this doesn't work, create the bucket manually in the Dashboard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'story-images'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'story-images',
      'story-images',
      true,
      5242880, -- 5MB limit
      ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    );
  END IF;
END $$;

-- RLS Policies for story-images bucket
-- These policies control who can upload, read, and delete images

-- Policy: Allow authenticated users to upload images to their organization's folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload story images to their org folder'
  ) THEN
    CREATE POLICY "Users can upload story images to their org folder"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'story-images' AND
      (storage.foldername(name))[1] = (SELECT org_id::text FROM public.users WHERE id = auth.uid()::uuid)
    );
  END IF;
END $$;

-- Policy: Allow authenticated users to read images from their organization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can read story images from their org'
  ) THEN
    CREATE POLICY "Users can read story images from their org"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'story-images' AND
      (storage.foldername(name))[1] = (SELECT org_id::text FROM public.users WHERE id = auth.uid()::uuid)
    );
  END IF;
END $$;

-- Policy: Allow authenticated users to delete images from their organization's folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete story images from their org folder'
  ) THEN
    CREATE POLICY "Users can delete story images from their org folder"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'story-images' AND
      (storage.foldername(name))[1] = (SELECT org_id::text FROM public.users WHERE id = auth.uid()::uuid)
    );
  END IF;
END $$;

-- Policy: Allow public read access to story images (for displaying in stories)
-- This allows images to be displayed without authentication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public can read story images'
  ) THEN
    CREATE POLICY "Public can read story images"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'story-images');
  END IF;
END $$;

