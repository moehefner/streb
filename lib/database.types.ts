// Database type definitions will be generated here
// Run: npx supabase gen types typescript --project-id your-project-id > lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: { [key: string]: unknown };
        Insert: { [key: string]: unknown };
        Update: { [key: string]: unknown };
      };
    };
  };
}
