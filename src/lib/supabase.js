import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jvznmonrbrfgvxhovcih.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2em5tb25yYnJmZ3Z4aG92Y2loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTAyODEsImV4cCI6MjA5MTc2NjI4MX0.RIACTV4YA4uglcSTngGnojpZKyGJXUp-x4iPHP6oMsQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
