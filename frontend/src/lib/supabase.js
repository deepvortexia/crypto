import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://ibpgbqbgzflsbqkgnkit.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicGdicWJnemZsc2Jxa2dua2l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzkyNTIsImV4cCI6MjA5MzQxNTI1Mn0.ho-ERur2QgsUOen8HqWNir5H9pVe8TZkV72fLZE2mCs'
)
