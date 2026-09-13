"use client";
import React from "react";

export function RadioRow({
  selected,
  onClick,
  title,
  subtitle,
  danger,
  accentText,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  danger?: boolean;
  accentText: string;
  children?: React.ReactNode;
}) {
  const ringColor = danger ? "#c15a3d" : accentText;
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${selected ? ringColor : "var(--border)"}`,
        background: selected ? "var(--active)" : "transparent",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div
          style={{
            marginTop: 2,
            width: 15,
            height: 15,
            flex: "0 0 auto",
            borderRadius: "50%",
            border: `2px solid ${selected ? ringColor : "var(--border)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected && <div style={{ width: 7, height: 7, borderRadius: "50%", background: ringColor }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: danger ? ringColor : "var(--ink)" }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>
        </div>
      </div>
      {selected && children}
    </div>
  );
}
