"use client";
import React, { useEffect, useRef } from "react";
import { ForceGraph } from "@/lib/graph/ForceGraph";
import { useVaultStore, linksOf } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";

export function GraphView({ split = false }: { split?: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraph | null>(null);
  const theme = useDerivedTheme();
  const notes = useVaultStore((s) => s.notes);
  const navigate = useVaultStore((s) => s.navigate);
  const splitOpenNote = useVaultStore((s) => s.splitOpenNote);
  const goCategory = useVaultStore((s) => s.goCategory);
  const openOrCreate = useVaultStore((s) => s.openOrCreate);

  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    if (!hostRef.current) return;
    const g = new ForceGraph({
      getNotes: () => useVaultStore.getState().notes,
      getCategories: () => useVaultStore.getState().categories,
      getLinksOf: linksOf,
      getByTitle: (t) => useVaultStore.getState().byTitle(t),
      getCurId: () => (split ? useVaultStore.getState().splitCurId() : useVaultStore.getState().curId()),
      getTheme: () => ({ isDark: themeRef.current.isDark, accent: themeRef.current.accent }),
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
    });
    graphRef.current = g;
    g.mount(hostRef.current);
    return () => g.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    graphRef.current?.buildData();
  }, [notes]);

  return <div style={{ flex: 1, minHeight: 0, position: "relative" }} ref={hostRef} />;
}
