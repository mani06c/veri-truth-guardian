import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Scan {
  id: string;
  user_id: string;
  scan_type: "image" | "text" | "video" | "url";
  input_label: string | null;
  file_path: string | null;
  verdict: string | null;
  confidence: number | null;
  source_type: string | null;
  details: Record<string, any>;
  effects: any[];
  created_at: string;
}

export function useScans() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const scansQuery = useQuery({
    queryKey: ["scans", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Scan[];
    },
  });

  const saveScan = useMutation({
    mutationFn: async (scan: Omit<Scan, "id" | "created_at" | "user_id">) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("scans")
        .insert({ ...scan, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as Scan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans", user?.id] });
    },
  });

  return { scans: scansQuery.data ?? [], isLoading: scansQuery.isLoading, saveScan };
}