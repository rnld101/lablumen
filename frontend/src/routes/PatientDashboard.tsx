import { useState } from "react";

import { BookingWorkspace } from "@/components/BookingWorkspace";
import { BentoCard } from "@/components/BentoCard";
import { ReportPreviewModal } from "@/components/ReportPreviewModal";
import { Button } from "@/components/ui/button";
import { useReports } from "@/hooks/useReports";
import { type Report } from "@/lib/api";

export function PatientDashboard() {
  const { data: reports, isLoading } = useReports();
  const [previewReport, setPreviewReport] = useState<Report | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4">
      <BentoCard title="Book a Lab Test">
        <BookingWorkspace />
      </BentoCard>

      <BentoCard title="My Reports">
        {isLoading ? (
          <p className="text-sm text-text-muted">Loading reports…</p>
        ) : reports && reports.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {reports.map((r) => (
              <li key={r.report_id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-text-dark">{r.test_name}</p>
                  <p className="text-xs text-text-muted">
                    {r.patient_name} · {new Date(r.created_at).toLocaleDateString()} ·{" "}
                    {r.has_summary ? (
                      <span className="text-success">Ready</span>
                    ) : r.processing_failed ? (
                      <span className="text-danger">Processing failed</span>
                    ) : (
                      <span className="text-warning">Processing…</span>
                    )}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPreviewReport(r)}>
                  View Report
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">
            No reports yet. Once a lab uploads your results, they appear here.
          </p>
        )}
      </BentoCard>

      <ReportPreviewModal
        report={previewReport}
        onClose={() => setPreviewReport(null)}
      />
    </div>
  );
}
