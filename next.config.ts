import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serverless functions handle all API routes for reliable pgvector + OpenAI calls
  // Edge Functions will be introduced for read-heavy paths in Phase 1
  
  // Increase body size limit for memory content
  serverExternalPackages: ['@supabase/supabase-js'],
};

export default nextConfig;
