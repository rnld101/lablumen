import { useState } from "react";

import { BookingWorkspace } from "@/components/BookingWorkspace";
import { BentoCard } from "@/components/BentoCard";
import { ReportChatModal } from "@/components/ReportChatModal";
import { ReportPreviewModal } from "@/components/ReportPreviewModal";
import { Button } from "@/components/ui/button";
import { useReports } from "@/hooks/useReports";
import { api, type Report } from "@/lib/api";

export function PatientDashboard() {
  const { data: reports, isLoading } = useReports();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [chatReport, setChatReport] = useState<Report | null>(null);

  const openPreview = async (reportId: string) => {
    setPreviewOpen(true);
    setPreviewUrl(null);
    try {
      const { url } = await api.viewReport(reportId);
      setPreviewUrl(url);
    } catch {
      setPreviewOpen(false);
    }
  };

  const latestSummary = reports?.find((r) => r.has_summary)?.summary ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
      <BentoCard title="Book a Lab Test" className="md:col-span-5">
        <BookingWorkspace />
      </BentoCard>

      <div className="md:col-span-3">
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
                      ) : (
                        <span className="text-warning">Processing…</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openPreview(r.report_id)}>
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      disabled={!r.has_summary}
                      onClick={() => setChatReport(r)}
                    >
                      Chat
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">
              No reports yet. Once a lab uploads your results, they appear here.
            </p>
          )}
        </BentoCard>
      </div>

      <div className="md:col-span-2">
        <BentoCard title="AI Layman Summary">
          {latestSummary ? (
            <p className="whitespace-pre-wrap text-sm text-text-muted">{latestSummary}</p>
          ) : (
            <p className="text-sm text-text-muted">
              Your most recent report’s plain-language summary will show here once it’s processed.
            </p>
          )}
        </BentoCard>
      </div>

      <ReportPreviewModal
        open={previewOpen}
        url={previewUrl}
        onClose={() => setPreviewOpen(false)}
      />
      <ReportChatModal
        open={chatReport !== null}
        reportId={chatReport?.report_id ?? null}
        reportName={chatReport?.test_name}
        onClose={() => setChatReport(null)}
      />
    </div>
  );
}
