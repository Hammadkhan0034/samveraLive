-- Migration: Add image_data field to story_items table
-- This allows storing base64 image data directly in story items
-- Run this migration to fix the issue where story items with base64 images were failing to save

ALTER TABLE public.story_items 
ADD COLUMN IF NOT EXISTS image_data text null;

-- Add comment to document the field
COMMENT ON COLUMN public.story_items.image_data IS 'Stores base64-encoded image data (data URLs) for story items. Used when upload_id is not available or when storing images directly.';

