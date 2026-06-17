import { useQuery } from "@tanstack/react-query";

import { api, type Report } from "@/lib/api";

export function useReports() {
  return useQuery<Report[]>({
    queryKey: ["reports"],
    queryFn: api.listReports,
    // Reports become "ready" asynchronously after a staff upload; poll while any are still
    // processing so the summary/preview light up without a manual refresh.
    refetchInterval: (query) =>
      query.state.data?.some((r) => !r.has_summary) ? 4000 : false,
  });
}
