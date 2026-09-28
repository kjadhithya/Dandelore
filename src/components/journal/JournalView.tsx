"use client";
import React, { useMemo } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { BackIcon, ForwardIcon } from "@/components/icons/Icons";
import { formatDate } from "@/lib/date";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function JournalView() {
  const s = useVaultStore();
  const { accent, accentButtonText } = useDerivedTheme();
  const TODAY = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const y = s.calYear;
  const mo = s.calMonth;
  const firstDow = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();

  const byDay = useMemo(() => {
    const m: Record<string, typeof s.notes> = {};
    s.notes.forEach((n) => {
      if (n.date) (m[n.date] = m[n.date] || []).push(n);
    });
    return m;
  }, [s.notes]);

  const cells: { label: string; iso?: string; hasNote?: boolean }[] = [];
  for (let k = 0; k < firstDow; k++) cells.push({ label: "" });
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ label: String(d), iso, hasNote: !!byDay[iso] });
  }

  const dayNotes = (byDay[s.calSelected] || []).map((n) => {
    const line = n.content.split("\n").find((l) => l.trim() && !/^#\s/.test(l)) || "";
    const sn = line.replace(/[#*`>[\]]/g, "").trim().slice(0, 50);
    return { note: n, snippet: sn || "—" };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "26px 22px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 20, color: "var(--ink)", flex: 1 }}>
              {MONTHS[mo]} {y}
            </div>
            <div onClick={() => s.prevMonth()} title="Previous month" style={{ cursor: "pointer", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, color: "var(--muted)" }}>
              <BackIcon size={17} />
            </div>
            <div onClick={() => s.nextMonth()} title="Next month" style={{ cursor: "pointer", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, color: "var(--muted)" }}>
              <ForwardIcon size={17} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>
            {WEEKDAYS.map((wd) => (
              <div key={wd} style={{ textAlign: "center", fontSize: 11, color: "var(--faint)", fontWeight: 600 }}>
                {wd}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
            {cells.map((cell, i) => {
              if (!cell.iso) return <div key={i} style={{ height: 50 }} />;
              const today = cell.iso === TODAY;
              const sel = cell.iso === s.calSelected;
              const has = cell.hasNote;
              const style: React.CSSProperties = {
                height: 50,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 9,
                cursor: "pointer",
                fontSize: 13,
                ...(sel
                  ? { background: accent, color: accentButtonText, fontWeight: 600 }
                  : today
                    ? { background: "var(--active)", color: "var(--ink)", fontWeight: 600, border: "1px solid var(--border)" }
                    : has
                      ? { background: "var(--panel)", color: "var(--ink)", border: "1px solid var(--border)" }
                      : { background: "var(--bg)", color: "var(--faint)", border: "1px solid var(--border-soft)" }),
              };
              return (
                <div key={i} onClick={() => s.setCalSelected(cell.iso!)} style={style}>
                  <span>{cell.label}</span>
                  {has && <span style={{ width: 5, height: 5, borderRadius: "50%", background: sel ? accentButtonText : accent, marginTop: 3 }} />}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 15, color: "var(--ink)", flex: 1 }}>{formatDate(s.calSelected)}</div>
            <span onClick={() => s.newDaily()} style={{ cursor: "pointer", fontSize: 12, color: accentButtonText, background: accent, padding: "6px 12px", borderRadius: 7 }}>
              + Daily note
            </span>
          </div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {dayNotes.map(({ note, snippet }) => (
              <div
                key={note.id}
                onClick={() => s.navigate(note.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  s.onNoteContext(note.id, e.clientX, e.clientY);
                }}
                style={{ cursor: "pointer", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 13px" }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{note.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
                  {note.folder} · {snippet}
                </div>
              </div>
            ))}
            {dayNotes.length === 0 && <div style={{ fontSize: 12.5, color: "var(--faint)", fontStyle: "italic" }}>No notes on this day.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
