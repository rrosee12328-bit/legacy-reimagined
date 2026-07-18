import { createClient } from "@supabase/supabase-js";

// Public/anon key — safe to expose in client code (protected by RLS).
const SUPABASE_URL = "https://qlvsbsfddwuocfihsleq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdnNic2ZkZHd1b2NmaWhzbGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMzMyNTMsImV4cCI6MjA5OTkwOTI1M30.0OYygnsDw16SpkeTOuWkmbvig7mTvHnn9F4AP6Si7-Y";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export type LeadScore = "hot" | "warm" | "cold";

export interface LeadInput {
  full_name: string;
  email: string;
  phone: string;
  business_name: string;
  business_type?: string;
  time_in_business: "under_6_months" | "6_to_24_months" | "over_2_years";
  monthly_revenue: "under_3k" | "3k_to_10k" | "over_10k";
  credit_score: "under_650" | "650_to_699" | "700_plus";
  funding_amount: string;
  notes?: string;
}

export function scoreLead(input: LeadInput): LeadScore {
  const creditGood = input.credit_score === "700_plus";
  const creditOk = input.credit_score === "650_to_699";
  const timeGood = input.time_in_business === "over_2_years";
  const timeOk = input.time_in_business === "6_to_24_months";
  const revGood = input.monthly_revenue === "over_10k";
  const revOk = input.monthly_revenue === "3k_to_10k";

  if (creditGood && timeGood && revGood) return "hot";
  if ((creditGood || creditOk) && (timeGood || timeOk) && (revGood || revOk))
    return "warm";
  return "cold";
}
