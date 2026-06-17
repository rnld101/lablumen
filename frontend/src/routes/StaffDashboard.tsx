import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { BentoCard } from "@/components/BentoCard";
import { Button } from "@/components/ui/button";
import { useOps } from "@/hooks/useOps";
import { api, type OpsRow } from "@/lib/api";

const STATUSES = ["Booked", "Checked-In", "Completed", "Cancelled"];

function OpsRowItem({ row }: { row: OpsRow }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  const setStatus = useMutation({
    mutationFn: (newStatus: string) =>
      api.updateAppointmentStatus(row.appointment_id, newStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops"] }),
    onError: (e) => setNote(e instanceof Error ? e.message : "Status update failed"),
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadReport(row.mapping_id, file),
    onSuccess: () => {
      setNote("Uploaded — AI processing started.");
      queryClient.invalidateQueries({ queryKey: ["ops"] });
    },
    onError: (e) => setNote(e instanceof Error ? e.message : "Upload failed"),
  });

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 pr-3 text-sm text-text-dark">{row.patient_name}</td>
      <td className="py-2 pr-3 text-sm text-text-dark">{row.test_name}</td>
      <td className="py-2 pr-3 text-xs text-text-muted">
        {row.appointment_date} {row.time_slot}
      </td>
      <td className="py-2 pr-3">
        <select
          value={row.status}
          onChange={(e) => setStatus.mutate(e.target.value)}
          disabled={setStatus.isPending}
          className="rounded-bento border border-slate-200 px-2 py-1 text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 text-right">
        {row.has_report ? (
          <span className="text-xs font-medium text-success">Report uploaded</span>
        ) : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={upload.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1 h-3 w-3" />
              {upload.isPending ? "Uploading…" : "Upload PDF"}
            </Button>
          </>
        )}
        {note && <p className="mt-1 text-[11px] text-text-muted">{note}</p>}
      </td>
    </tr>
  );
}

export function StaffDashboard() {
  const { data: ops, isLoading } = useOps();

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const appts = new Set(ops?.map((r) => r.appointment_id));
    const todayAppts = new Set(
      ops?.filter((r) => r.appointment_date === today).map((r) => r.appointment_id),
    );
    const pendingUploads = ops?.filter((r) => !r.has_report).length ?? 0;
    return { total: appts.size, today: todayAppts.size, pendingUploads };
  }, [ops]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <BentoCard title="Today's Scheduled Volume">
        <p className="text-3xl font-semibold text-primary">{stats.today}</p>
      </BentoCard>
      <BentoCard title="Pending PDF Uploads">
        <p className="text-3xl font-semibold text-warning">{stats.pendingUploads}</p>
      </BentoCard>
      <BentoCard title="Total Orders">
        <p className="text-3xl font-semibold text-text-dark">{stats.total}</p>
      </BentoCard>

      <BentoCard title="Operations Queue" className="md:col-span-3">
        {isLoading ? (
          <p className="text-sm text-text-muted">Loading queue…</p>
        ) : ops && ops.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-text-muted">
                  <th className="py-2 pr-3 font-medium">Patient</th>
                  <th className="py-2 pr-3 font-medium">Test</th>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Report</th>
                </tr>
              </thead>
              <tbody>
                {ops.map((row) => (
                  <OpsRowItem key={row.mapping_id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            No orders yet. Once patients book tests, their orders appear here.
          </p>
        )}
      </BentoCard>
    </div>
  );
}
