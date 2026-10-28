import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL||'https://veugczctbvjnjwlxtxyh.supabase.co';
const key=import.meta.env.VITE_SUPABASE_ANON_KEY||'sb_publishable_zpoGk7bGTzUJ5EcBVBQwyw_aTCER6du';
export const cloudConfigured=Boolean(url&&key);
export const supabase=cloudConfigured?createClient(url,key):null;
