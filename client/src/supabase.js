import { createClient } from '@supabase/supabase-js'

// Both values come from client/.env (see .env.example) and are compiled into
// the built JavaScript. That is fine: the publishable key is meant to be
// public, and Row Level Security (supabase/schema.sql) is what protects data.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Accounts are on when both are set. Without them the app runs as before,
// with no login, on the demo or Express backend (see src/api/index.js).
export const SUPABASE_ENABLED = Boolean(supabaseUrl && supabaseKey)

export const supabase = SUPABASE_ENABLED ? createClient(supabaseUrl, supabaseKey) : null
