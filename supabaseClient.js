import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// REPLACE THESE TWO VALUES WITH YOUR OWN SUPABASE PROJECT.
// Find them in your Supabase dashboard: Settings -> API
// The anon public key is safe to expose in frontend code.
// Never put your service_role key here.
// ============================================================
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
