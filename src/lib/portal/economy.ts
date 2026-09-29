import "server-only";
import { cache } from "react";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type EconomyChild = {
  student_id: string;
  name: string;
  owed: number;
  paid: number;
  remaining: number;
};

export type EconomyInstallment = {
  id: string;
  due_date: string;
  amount: number;
  status: "planlagt" | "sendt" | "betalt";
  payment_id: string | null;
  children: string[];
};

export type EconomyPayment = {
  id: string;
  created_at: string;
  paid_at: string | null;
  amount: number;
  refunded_amount: number;
  method: string;
  status: "autorisert" | "fanget" | "refundert";
  children: { name: string; amount: number }[];
};

export type EconomyFamily = {
  family_id: string;
  display_name: string | null;
  school_year_id: string | null;
  school_year_label: string | null;
  children: EconomyChild[];
  total_remaining: number;
  installments: EconomyInstallment[];
  payments: EconomyPayment[];
};

export const getMyEconomy = cache(async (): Promise<EconomyFamily[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_my_economy");
  if (error) {
    console.error("portal_my_economy failed", error);
    return [];
  }
  return Array.isArray(data) ? (data as unknown as EconomyFamily[]) : [];
});
