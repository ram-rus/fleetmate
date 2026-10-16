import { createClient } from '@supabase/supabase-js';

const URL = process.env.REACT_APP_SUPABASE_URL || 'https://dbmlukdtykshvtnofbby.supabase.co';
const KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

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
