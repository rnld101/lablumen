import { useQuery } from "@tanstack/react-query";

import { api, type OpsRow } from "@/lib/api";

export function useOps() {
  return useQuery<OpsRow[]>({
    queryKey: ["ops"],
    queryFn: api.listOps,
  });
}
