import { createClient } from "@supabase/supabase-js";

// The anon key is safe to expose in frontend code — it can only do what
// our Row Level Security policies allow. Never put the service_role key here.
const SUPABASE_URL = "https://qkpptlrhvxuzcqxpvjmd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcHB0bHJodnh1emNxeHB2am1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQyMTcsImV4cCI6MjA5OTU0MDIxN30.L5cxZKdEPE0DcLNC7RMCjDc7AX22I0X4QaTZQFkvuLY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
