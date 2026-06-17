import { useQuery } from "@tanstack/react-query";

import { api, type PatientProfile } from "@/lib/api";

export function usePatients() {
  return useQuery<PatientProfile[]>({
    queryKey: ["patients"],
    queryFn: api.listPatients,
  });
}
