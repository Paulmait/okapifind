-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================

-- Create meter-photos bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meter-photos',
  'meter-photos',
  false, -- Private bucket
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Policy: Users can upload to their own folder
CREATE POLICY "Users can upload own meter photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'meter-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view their own meter photos
CREATE POLICY "Users can view own meter photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'meter-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own meter photos
CREATE POLICY "Users can update own meter photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'meter-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own meter photos
CREATE POLICY "Users can delete own meter photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'meter-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- ADDITIONAL BUCKETS (Optional)
-- ============================================

-- Create avatars bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true, -- Public bucket for profile pictures
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- Policy: Users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Anyone can view avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Policy: Users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);