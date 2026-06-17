import { Send, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ReportChatModalProps {
  open: boolean;
  reportId: string | null;
  reportName?: string;
  onClose: () => void;
}

// Document-scoped RAG chat: questions are answered only from this report's embedded chunks.
export function ReportChatModal({ open, reportId, reportName, onClose }: ReportChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!open || !reportId) return null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || sending) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setSending(true);
    try {
      const res = await api.chatWithReport(reportId, question);
      setMessages((m) => [...m, { role: "assistant", content: res.answer }]);
      setDisclaimer(res.disclaimer);
      requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-bento bg-white shadow-bento-diffused">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <h2 className="text-base font-semibold text-text-dark">Ask about your report</h2>
            {reportName && <p className="text-xs text-text-muted">{reportName}</p>}
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close chat">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-surface p-4">
          {messages.length === 0 && (
            <p className="text-sm text-text-muted">
              Ask a question like “What does my cholesterol result mean?” — answers come only from
              this report.
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
                    ? "max-w-[80%] rounded-bento bg-primary px-3 py-2 text-sm text-white"
                    : "max-w-[80%] whitespace-pre-wrap rounded-bento bg-white px-3 py-2 text-sm text-text-dark shadow-bento-diffused"
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && <p className="text-xs text-text-muted">Thinking…</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        {disclaimer && (
          <p className="border-t border-slate-100 bg-warning/5 px-4 py-2 text-xs text-text-muted">
            {disclaimer}
          </p>
        )}

        <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-100 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question…"
            className="flex-1 rounded-bento border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <Button type="submit" size="icon" disabled={sending} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
