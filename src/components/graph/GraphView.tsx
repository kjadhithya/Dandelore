"use client";
import React, { useEffect, useRef, useState } from "react";
import { ForceGraph } from "@/lib/graph/ForceGraph";
import { useVaultStore, linksOf, noteTags } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { useGraphSettings, type GraphSection, type GraphSettings } from "@/lib/graph/graphSettings";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { MoreIcon, SettingsIcon, CloseIcon, SearchIcon } from "@/components/icons/Icons";

export function GraphView({
  split = false,
  bookmarkId,
  renderNav,
}: {
  split?: boolean;
  /** Set when opened from a graph bookmark: its saved settings are applied. */
  bookmarkId?: string;
  /** Renders the pane's back/forward bar, with the graph's ⋯ menu on its right. */
  renderNav?: (right: React.ReactNode) => React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraph | null>(null);
  const theme = useDerivedTheme();
  const notes = useVaultStore((s) => s.notes);
  const categories = useVaultStore((s) => s.categories);
  const navigate = useVaultStore((s) => s.navigate);
  const splitOpenNote = useVaultStore((s) => s.splitOpenNote);
  const goCategory = useVaultStore((s) => s.goCategory);
  const openOrCreate = useVaultStore((s) => s.openOrCreate);
  const openSearch = useVaultStore((s) => s.openSearch);
  const settings = useGraphSettings((s) => s.settings);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    if (!hostRef.current) return;
    useGraphSettings.getState().hydrate();
    if (bookmarkId) useGraphSettings.getState().applyBookmark(bookmarkId);
    const g = new ForceGraph({
      getNotes: () => useVaultStore.getState().notes,
      getCategories: () => useVaultStore.getState().categories,
      getLinksOf: linksOf,
      getTags: noteTags,
      getByTitle: (t) => useVaultStore.getState().byTitle(t),
      getCurId: () => (split ? useVaultStore.getState().splitCurId() : useVaultStore.getState().curId()),
      getTheme: () => ({ isDark: themeRef.current.isDark, accent: themeRef.current.accent }),
      getSettings: () => useGraphSettings.getState().settings,
      onNodeClick: (id) => {
        if (split) {
          useVaultStore.setState({ lastPane: "split" });
          splitOpenNote(id);
        } else {
          navigate(id);
        }
      },
      onCategoryClick: (name) => goCategory(name),
      onPhantomClick: (title) => openOrCreate(title),
      onTagClick: (tag) => openSearch(tag),
    });
    graphRef.current = g;
    g.mount(hostRef.current);
    return () => g.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opening a different graph bookmark in this same tab.
  useEffect(() => {
    if (bookmarkId && graphRef.current) useGraphSettings.getState().applyBookmark(bookmarkId);
  }, [bookmarkId]);

  useEffect(() => {
    graphRef.current?.buildData();
  }, [notes, categories]);

  // Filters and groups change which nodes exist (and their colours); forces
  // need the layout woken up to move into their new balance.
  const forcesKey = `${settings.centerForce}|${settings.repelForce}|${settings.linkForce}|${settings.linkDistance}`;
  useEffect(() => {
    graphRef.current?.buildData();
  }, [settings.search, settings.showTags, settings.showAttachments, settings.existingOnly, settings.showOrphans, settings.groups]);
  useEffect(() => {
    graphRef.current?.reheat();
  }, [forcesKey]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(t);
  }, [notice]);

  const startTimelapse = () => {
    const byId = new Map(useVaultStore.getState().notes.map((n) => [n.id, n]));
    graphRef.current?.startTimelapse((id) => {
      const n = byId.get(id);
      return n ? n.date || n.modified || "" : "";
    });
  };

  const copyScreenshot = async () => {
    const blob = await graphRef.current?.screenshot();
    if (!blob) return setNotice("Couldn't take a screenshot");
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setNotice("Screenshot copied to clipboard");
    } catch {
      setNotice("Your browser blocked copying the image");
    }
  };

  return (
    <>
      {renderNav?.(<GraphMoreMenu onCopyScreenshot={copyScreenshot} />)}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0 }} ref={hostRef} />
        {!panelOpen && (
          <div style={{ position: "absolute", top: 10, right: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            <FloatBtn title="Open graph settings" onClick={() => setPanelOpen(true)}>
              <SettingsIcon size={19} />
            </FloatBtn>
            <FloatBtn title="Start timelapse animation" onClick={startTimelapse}>
              <WandIcon />
            </FloatBtn>
          </div>
        )}
        {panelOpen && <GraphSettingsPanel onClose={() => setPanelOpen(false)} onAnimate={startTimelapse} />}
        {notice && (
          <div
            role="status"
            style={{ position: "absolute", left: "50%", bottom: 18, transform: "translateX(-50%)", background: "var(--panel)", border: "1px solid var(--border)", color: "var(--ink)", fontSize: 12.5, padding: "8px 14px", borderRadius: 8, boxShadow: "0 10px 30px -10px rgba(0,0,0,.45)", whiteSpace: "nowrap" }}
          >
            {notice}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ⋯ menu: Split right / Split down / Copy screenshot / Bookmark…

function GraphMoreMenu({ onCopyScreenshot }: { onCopyScreenshot: () => void }) {
  const isMobile = useIsMobile();
  const splitOpenView = useVaultStore((s) => s.splitOpenView);
  const [open, setOpen] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} style={{ position: "relative", marginLeft: "auto" }}>
      <div
        title="More options"
        onClick={() => setOpen((v) => !v)}
        style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: open ? "var(--ink)" : "var(--muted)", background: open ? "var(--active)" : "transparent" }}
      >
        <MoreIcon size={18} />
      </div>
      {open && (
        <div style={{ position: "absolute", top: 36, right: 0, zIndex: 40, minWidth: 190, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 16px 40px -12px rgba(0,0,0,.45)", padding: 5 }}>
          {!isMobile && (
            <>
              <MenuRow onClick={pick(() => splitOpenView("right", { kind: "graph" }))}>Split right</MenuRow>
              <MenuRow onClick={pick(() => splitOpenView("down", { kind: "graph" }))}>Split down</MenuRow>
              <div style={{ height: 1, background: "var(--border)", margin: "5px 8px" }} />
            </>
          )}
          <MenuRow onClick={pick(onCopyScreenshot)}>Copy screenshot</MenuRow>
          <MenuRow onClick={pick(() => setBookmarkOpen(true))}>Bookmark…</MenuRow>
        </div>
      )}
      {bookmarkOpen && <BookmarkDialog onClose={() => setBookmarkOpen(false)} />}
    </div>
  );
}

function MenuRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: "8px 13px", fontSize: 13, color: "var(--ink)", cursor: "pointer", borderRadius: 6, background: hover ? "var(--active)" : "transparent" }}
    >
      {children}
    </div>
  );
}

function BookmarkDialog({ onClose }: { onClose: () => void }) {
  const isMobile = useIsMobile();
  const { accent, accentButtonText } = useDerivedTheme();
  const addBookmark = useGraphSettings((s) => s.addBookmark);
  const [title, setTitle] = useState("Graph view");
  const save = () => {
    addBookmark(title);
    onClose();
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 80, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? "100%" : 380,
          background: "var(--bg)",
          border: isMobile ? "none" : "1px solid var(--border)",
          borderRadius: isMobile ? "16px 16px 0 0" : 12,
          padding: isMobile ? "20px 18px calc(18px + env(safe-area-inset-bottom, 0px))" : "20px 20px 18px",
          boxShadow: "0 18px 44px -12px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 17, color: "var(--ink)", marginBottom: 14 }}>Bookmark graph view</div>
        <label htmlFor="graph-bookmark-title" style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>
          Title
        </label>
        <input
          id="graph-bookmark-title"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onClose();
          }}
          onFocus={(e) => e.currentTarget.select()}
          style={{ width: "100%", boxSizing: "border-box", fontSize: 14, color: "var(--ink)", background: "var(--input)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 11px", outline: "none" }}
        />
        <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 8, lineHeight: 1.45 }}>Saves this graph&apos;s filters, groups and display settings. Find it under Bookmarks.</div>
        <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
          <div onClick={onClose} style={{ flex: 1, textAlign: "center", cursor: "pointer", fontSize: 13.5, color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 14px" }}>
            Cancel
          </div>
          <div onClick={save} style={{ flex: 1, textAlign: "center", cursor: "pointer", fontSize: 13.5, fontWeight: 500, color: accentButtonText, background: accent, borderRadius: 9, padding: "10px 14px" }}>
            Save
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating buttons (top-right of the graph)

function FloatBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: hover ? "var(--ink)" : "var(--muted)", background: hover ? "var(--active)" : "transparent" }}
    >
      {children}
    </div>
  );
}

function WandIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20 16 8" />
      <path d="m14.5 6.5 3 3" />
      <path d="M17 2.5v3M15.5 4h3" />
      <path d="M20.5 9v3M19 10.5h3" />
      <path d="M8.5 3v2.4M7.3 4.2h2.4" />
    </svg>
  );
}

function ResetIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 3 3 9 9 9" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Settings panel — Obsidian's sections, controls, ranges and defaults.

function GraphSettingsPanel({ onClose, onAnimate }: { onClose: () => void; onAnimate: () => void }) {
  const st = useGraphSettings();
  const cfg = st.settings;
  const { accent } = useDerivedTheme();
  const set = (patch: Partial<GraphSettings>) => st.set(patch);

  return (
    <div
      className="vscroll"
      style={{
        position: "absolute",
        top: 10,
        right: 12,
        width: "min(300px, calc(100% - 24px))",
        maxHeight: "calc(100% - 20px)",
        overflowY: "auto",
        boxSizing: "border-box",
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 16px 40px -14px rgba(0,0,0,.5)",
        fontSize: 13,
        color: "var(--ink)",
        zIndex: 5,
      }}
    >
      <Section
        id="filters"
        title="Filters"
        actions={
          <>
            <PanelIcon title="Restore default settings" onClick={st.reset}>
              <ResetIcon />
            </PanelIcon>
            <PanelIcon title="Close" onClick={onClose}>
              <CloseIcon size={16} />
            </PanelIcon>
          </>
        }
      >
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--faint)", display: "flex" }}>
            <SearchIcon size={14} />
          </span>
          <input
            id="graph-search"
            value={cfg.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search files..."
            aria-label="Search files"
            style={{ width: "100%", boxSizing: "border-box", fontSize: 13, color: "var(--ink)", background: "var(--input)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px 7px 30px", outline: "none" }}
          />
        </div>
        <Toggle id="graph-tags" label="Tags" on={cfg.showTags} onChange={(v) => set({ showTags: v })} accent={accent} />
        <Toggle id="graph-attachments" label="Attachments" on={cfg.showAttachments} onChange={(v) => set({ showAttachments: v })} accent={accent} />
        <Toggle id="graph-existing" label="Existing files only" on={cfg.existingOnly} onChange={(v) => set({ existingOnly: v })} accent={accent} />
        <Toggle id="graph-orphans" label="Orphans" on={cfg.showOrphans} onChange={(v) => set({ showOrphans: v })} accent={accent} />
      </Section>

      <Section id="groups" title="Groups">
        {cfg.groups.map((g, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              id={`graph-group-${i}`}
              value={g.query}
              onChange={(e) => st.setGroup(i, { query: e.target.value })}
              placeholder="Enter query..."
              aria-label="Group query"
              style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--ink)", background: "var(--input)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", outline: "none" }}
            />
            <label title="Group colour" style={{ position: "relative", width: 22, height: 22, borderRadius: "50%", background: g.color, flex: "0 0 auto", cursor: "pointer" }}>
              <input type="color" value={g.color} onChange={(e) => st.setGroup(i, { color: e.target.value })} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
            </label>
            <PanelIcon title="Delete group" onClick={() => st.removeGroup(i)}>
              <CloseIcon size={14} />
            </PanelIcon>
          </div>
        ))}
        <PanelButton onClick={st.addGroup} full>
          New group
        </PanelButton>
      </Section>

      <Section id="display" title="Display">
        <Toggle id="graph-arrows" label="Arrows" on={cfg.arrows} onChange={(v) => set({ arrows: v })} accent={accent} />
        <Slider id="graph-textfade" label="Text fade threshold" value={cfg.textFade} min={-3} max={3} step={0.1} onChange={(v) => set({ textFade: v })} accent={accent} />
        <Slider id="graph-nodesize" label="Node size" value={cfg.nodeSize} min={0.1} max={5} step={0.01} onChange={(v) => set({ nodeSize: v })} accent={accent} />
        <Slider id="graph-linkthickness" label="Link thickness" value={cfg.linkThickness} min={0.1} max={5} step={0.01} onChange={(v) => set({ linkThickness: v })} accent={accent} />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <PanelButton onClick={onAnimate}>Animate</PanelButton>
        </div>
      </Section>

      <Section id="forces" title="Forces" last>
        <Slider id="graph-center" label="Center force" value={cfg.centerForce} min={0} max={1} step={0.01} onChange={(v) => set({ centerForce: v })} accent={accent} />
        <Slider id="graph-repel" label="Repel force" value={cfg.repelForce} min={0} max={20} step={0.1} onChange={(v) => set({ repelForce: v })} accent={accent} />
        <Slider id="graph-linkforce" label="Link force" value={cfg.linkForce} min={0} max={1} step={0.01} onChange={(v) => set({ linkForce: v })} accent={accent} />
        <Slider id="graph-linkdistance" label="Link distance" value={cfg.linkDistance} min={30} max={500} step={1} decimals={0} onChange={(v) => set({ linkDistance: v })} accent={accent} />
      </Section>
    </div>
  );
}

function Section({ id, title, actions, last, children }: { id: GraphSection; title: string; actions?: React.ReactNode; last?: boolean; children: React.ReactNode }) {
  const collapsed = useGraphSettings((s) => s.collapsed[id]);
  const toggle = useGraphSettings((s) => s.toggleSection);
  return (
    <div style={{ padding: "10px 14px", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div
          role="button"
          aria-expanded={!collapsed}
          onClick={() => toggle(id)}
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, cursor: "pointer", padding: "4px 0", fontSize: 14, fontWeight: 500, color: "var(--ink)" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)", transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform .12s" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {title}
        </div>
        {actions}
      </div>
      {!collapsed && <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "10px 0 4px" }}>{children}</div>}
    </div>
  );
}

function PanelIcon({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "0 0 auto", color: hover ? "var(--ink)" : "var(--muted)", background: hover ? "var(--active)" : "transparent" }}
    >
      {children}
    </div>
  );
}

function PanelButton({ onClick, full, children }: { onClick: () => void; full?: boolean; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ textAlign: "center", cursor: "pointer", fontSize: 13, color: "var(--ink)", background: hover ? "var(--active)" : "var(--input)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px", width: full ? "100%" : undefined, boxSizing: "border-box" }}
    >
      {children}
    </div>
  );
}

function Toggle({ id, label, on, onChange, accent }: { id: string; label: string; on: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <label htmlFor={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }}>
      <span>{label}</span>
      <span style={{ position: "relative", width: 36, height: 20, borderRadius: 10, background: on ? accent : "var(--border)", transition: "background .15s", flex: "0 0 auto" }}>
        <input id={id} type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ position: "absolute", inset: 0, opacity: 0, margin: 0, cursor: "pointer" }} />
        <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "left .15s", pointerEvents: "none" }} />
      </span>
    </label>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  decimals = 2,
  onChange,
  accent,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  onChange: (v: number) => void;
  accent: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={id}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 38, fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{value.toFixed(decimals)}</span>
        <input
          id={id}
          className="graph-slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, minWidth: 0, accentColor: accent, background: `linear-gradient(to right, ${accent} ${pct}%, var(--border) ${pct}%)` }}
        />
      </div>
    </div>
  );
}
