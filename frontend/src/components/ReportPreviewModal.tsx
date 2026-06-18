import { ArrowLeft, Download, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { api, type Report } from "@/lib/api";

interface ReportPreviewModalProps {
  report: Report | null;
  onClose: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function ReportPreviewModal({ report, onClose }: ReportPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [panel, setPanel] = useState<"summary" | "chat">("summary");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!report) return;
    setPdfUrl(null);
    setPdfLoading(true);
    setPanel("summary");
    setMessages([]);
    setInput("");
    setChatError(null);
    api
      .viewReport(report.report_id)
      .then(({ url }) => setPdfUrl(url))
      .catch(() => {})
      .finally(() => setPdfLoading(false));
  }, [report?.report_id]);

  if (!report) return null;

  const openChat = () => {
    setPanel("chat");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || sending) return;
    setChatError(null);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user" as const, content: question }]);
    setInput("");
    setSending(true);
    try {
      const res = await api.chatWithReport(report.report_id, question, history);
      setMessages((m) => [...m, { role: "assistant" as const, content: res.answer }]);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight),
      );
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-[90vh] w-full max-w-6xl overflow-hidden rounded-bento bg-white shadow-bento-diffused">

        {/* ── Left: PDF viewer (70%) ──────────────────────────── */}
        <div className="flex w-[70%] flex-col border-r border-slate-100">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Diagnostic Report Preview
              </p>
              <h2 className="text-sm font-semibold text-text-dark">{report.test_name}</h2>
            </div>
            <div className="flex items-center gap-2">
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  download
                  className="flex items-center gap-1 rounded-bento border border-slate-200 px-3 py-1.5 text-xs font-medium text-text-dark hover:bg-slate-50"
                >
                  <Download className="h-3 w-3" />
                  Download PDF
                </a>
              )}
              <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden bg-slate-50">
            {pdfLoading ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-text-muted">Loading PDF…</p>
              </div>
            ) : pdfUrl ? (
              <iframe src={pdfUrl} className="h-full w-full border-0" title="Report PDF" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-danger">Could not load PDF</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Summary / Chat (30%) ─────────────────────── */}
        <div className="relative flex w-[30%] flex-col overflow-hidden">

          {/* Summary panel */}
          {panel === "summary" && (
            <>
              <div className="shrink-0 border-b border-slate-100 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  AI Summary
                </p>
                <h3 className="text-sm font-semibold text-text-dark">{report.patient_name}</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 pb-20">
                {report.summary ? (
                  <div className="prose prose-sm max-w-none text-text-dark">
                    <Markdown>{report.summary}</Markdown>
                  </div>
                ) : report.processing_failed ? (
                  <p className="text-sm text-danger">
                    The AI summary could not be generated. You can still preview and download the
                    report.
                  </p>
                ) : (
                  <p className="text-sm text-text-muted">
                    Summary is still processing — check back in a moment.
                  </p>
                )}
              </div>
              {/* Floating chat button — only when summary is ready */}
              {report.has_summary && (
                <button
                  onClick={openChat}
                  className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  aria-label="Open chat"
                >
                  <MessageCircle className="h-5 w-5" />
                </button>
              )}
            </>
          )}

          {/* Chat panel */}
          {panel === "chat" && (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3">
                <button
                  onClick={() => setPanel("summary")}
                  className="rounded p-1 text-text-muted hover:bg-slate-100 hover:text-text-dark"
                  aria-label="Back to summary"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Ask your report
                  </p>
                  <h3 className="text-sm font-semibold text-text-dark">{report.test_name}</h3>
                </div>
              </div>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-surface p-4">
                {messages.length === 0 && (
                  <p className="text-sm text-text-muted">
                    Ask anything — values, diet, lifestyle tips, or ask for a translation into your
                    language.
                  </p>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[85%] rounded-bento bg-primary px-3 py-2 text-sm text-white"
                          : "prose prose-sm max-w-none rounded-bento bg-white px-3 py-2 text-sm text-text-dark shadow-bento-diffused"
                      }
                    >
                      {m.role === "assistant" ? (
                        <Markdown>{m.content}</Markdown>
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <p className="text-xs italic text-text-muted">Thinking…</p>
                  </div>
                )}
                {chatError && <p className="text-sm text-danger">{chatError}</p>}
              </div>
              <p className="shrink-0 border-t border-slate-100 bg-warning/5 px-4 py-2 text-xs text-text-muted">
                For general understanding only — not medical advice.
              </p>
              <form
                onSubmit={sendMessage}
                className="flex shrink-0 items-center gap-2 border-t border-slate-100 p-3"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your question…"
                  className="flex-1 rounded-bento border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <Button type="submit" size="icon" disabled={sending} aria-label="Send">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
