-- Add video_url column to listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS video_url text;

-- Allow video MIME types in listing-images bucket and raise size limit for video
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm'
  ],
  file_size_limit = 104857600  -- 100 MB (frontend enforces 5 MB for images)
WHERE id = 'listing-images';
