import { createClient } from '@supabase/supabase-js';

// Les valeurs de secours permettent un build Netlify sans variables configurées.
// Cette clé est publique par conception : la sécurité repose sur RLS dans Supabase.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://veugczctbvjnjwlxtxyh.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zpoGk7bGTzUJ5EcBVBQwyw_aTCER6du';
export const cloudConfigured = Boolean(url && key);
export const supabase = cloudConfigured ? createClient(url, key) : null;
