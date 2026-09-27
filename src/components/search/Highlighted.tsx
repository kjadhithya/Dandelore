"use client";
import React from "react";
import { highlightParts } from "@/lib/search";

/** Renders text with the parts matching the search query highlighted. */
export function Highlighted({ text, query, color }: { text: string; query: string; color: string }) {
  return (
    <>
      {highlightParts(text, query).map((p, i) =>
        p.hit ? (
          <mark key={i} style={{ background: "transparent", color, fontWeight: 600 }}>
            {p.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        ),
      )}
    </>
  );
}
