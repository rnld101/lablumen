import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useLabTests } from "@/hooks/useLabTests";
import { usePatients } from "@/hooks/usePatients";
import { api, type PatientProfileCreate } from "@/lib/api";

const TIME_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
];

const EMPTY_PROFILE: PatientProfileCreate = {
  first_name: "",
  last_name: "",
  phone_number: "",
  date_of_birth: "",
  biological_gender: "Male",
  relationship_to_owner: "Self",
};

export function BookingWorkspace() {
  const queryClient = useQueryClient();
  const { data: tests } = useLabTests();
  const { data: patients } = usePatients();

  const [patientId, setPatientId] = useState<string>("");
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState(TIME_SLOTS[0]);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profile, setProfile] = useState<PatientProfileCreate>(EMPTY_PROFILE);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const activePatient = patientId || patients?.[0]?.patient_id || "";

  const total = useMemo(() => {
    if (!tests) return 0;
    return tests
      .filter((t) => selectedTests.has(t.test_id))
      .reduce((sum, t) => sum + Number(t.base_cost), 0);
  }, [tests, selectedTests]);

  const createProfile = useMutation({
    mutationFn: () => api.createPatient(profile),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setPatientId(created.patient_id);
      setShowProfileForm(false);
      setProfile(EMPTY_PROFILE);
    },
    onError: (e) => setFeedback({ kind: "err", text: e instanceof Error ? e.message : "Failed" }),
  });

  const book = useMutation({
    mutationFn: () =>
      api.bookAppointment({
        appointment_date: date,
        time_slot: slot,
        tests: [...selectedTests].map((test_id) => ({ test_id, patient_id: activePatient })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setSelectedTests(new Set());
      setDate("");
      setFeedback({ kind: "ok", text: "Appointment booked. A confirmation email is on its way." });
    },
    onError: (e) =>
      setFeedback({ kind: "err", text: e instanceof Error ? e.message : "Booking failed" }),
  });

  const toggleTest = (id: string) => {
    setSelectedTests((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const canBook = activePatient && selectedTests.size > 0 && date && slot && !book.isPending;

  return (
    <div className="space-y-4">
      {/* Patient profile */}
      <div>
        <label className="mb-1 block text-sm font-medium text-text-dark">Patient</label>
        {patients && patients.length > 0 ? (
          <div className="flex items-center gap-2">
            <select
              value={activePatient}
              onChange={(e) => setPatientId(e.target.value)}
              className="flex-1 rounded-bento border border-slate-200 px-3 py-2 text-sm"
            >
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.first_name} {p.last_name} ({p.relationship_to_owner})
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={() => setShowProfileForm((v) => !v)}>
              {showProfileForm ? "Cancel" : "Add profile"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            No patient profiles yet — add one to start booking.
            <Button
              size="sm"
              variant="outline"
              className="ml-2"
              onClick={() => setShowProfileForm(true)}
            >
              Add profile
            </Button>
          </p>
        )}
      </div>

      {showProfileForm && (
        <div className="grid grid-cols-2 gap-3 rounded-bento bg-surface p-3">
          <input
            placeholder="First name"
            value={profile.first_name}
            onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
            className="rounded-bento border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            placeholder="Last name"
            value={profile.last_name}
            onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
            className="rounded-bento border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            placeholder="Phone"
            value={profile.phone_number}
            onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
            className="rounded-bento border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={profile.date_of_birth}
            onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
            className="rounded-bento border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={profile.biological_gender}
            onChange={(e) => setProfile({ ...profile, biological_gender: e.target.value })}
            className="rounded-bento border border-slate-200 px-3 py-2 text-sm"
          >
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
          <input
            placeholder="Relationship (e.g. Self)"
            value={profile.relationship_to_owner}
            onChange={(e) => setProfile({ ...profile, relationship_to_owner: e.target.value })}
            className="rounded-bento border border-slate-200 px-3 py-2 text-sm"
          />
          <Button
            size="sm"
            className="col-span-2"
            disabled={createProfile.isPending}
            onClick={() => createProfile.mutate()}
          >
            {createProfile.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      )}

      {/* Test selection */}
      <div>
        <label className="mb-1 block text-sm font-medium text-text-dark">Select tests</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {tests?.map((t) => (
            <label
              key={t.test_id}
              className="flex cursor-pointer items-center justify-between rounded-bento border border-slate-200 px-3 py-2 text-sm hover:bg-surface"
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedTests.has(t.test_id)}
                  onChange={() => toggleTest(t.test_id)}
                />
                {t.name}
              </span>
              <span className="text-text-muted">${Number(t.base_cost).toFixed(2)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Date + slot */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-dark">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-bento border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-dark">Time slot</label>
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            className="w-full rounded-bento border border-slate-200 px-3 py-2 text-sm"
          >
            {TIME_SLOTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Total + submit */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-sm text-text-muted">
          {selectedTests.size} test(s) · <span className="font-semibold text-text-dark">${total.toFixed(2)}</span>
        </span>
        <Button disabled={!canBook} onClick={() => book.mutate()}>
          {book.isPending ? "Booking…" : "Book appointment"}
        </Button>
      </div>

      {feedback && (
        <p
          className={
            feedback.kind === "ok"
              ? "rounded-bento bg-success/10 px-3 py-2 text-sm text-success"
              : "rounded-bento bg-danger/10 px-3 py-2 text-sm text-danger"
          }
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
