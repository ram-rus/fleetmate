import { createClient } from '@supabase/supabase-js';

const URL = 'https://dbmlukdtykshvtnofbby.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRibWx1a2R0eWtzaHZ0bm9mYmJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjQ0NTMsImV4cCI6MjA5NjE0MDQ1M30.hBOfAboBbI2m3kzN1vpkZAL84_AwDv1j2jyyniHTy4Y';

export const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken:true, persistSession:true, detectSessionInUrl:false }
});

export async function uploadFile(bucket, file, folder) {
  const ext = file.name.split('.').pop().toLowerCase();
  const path = (folder||'uploads') + '/' + Date.now() + '.' + ext;
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert:false });
  if (error) throw error;
  return data.path;
}

export function getPublicUrl(bucket, path) {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}
