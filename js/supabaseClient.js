import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://lgdquwndwcnvaildaatq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jpx4rxaHPRdOV3hrH4VEew_kjyF9kyG';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
