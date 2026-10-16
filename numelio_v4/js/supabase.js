
const SUPABASE_URL = "https://fuiranswkbpljucgwocz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = sb_publishable_qJAZAQHqA0zMguqfo6IAgg_oWAdgS6h

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

window.numelioSupabase = supabaseClient;
