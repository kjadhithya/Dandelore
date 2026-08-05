"use client";
import { useEffect, useState } from "react";

// The desktop layout is Ribbon (41px) + Sidebar (256px default) + RightPanel
// (262px fixed) = ~560px of persistent chrome around the note itself. Below
// ~1024px (iPad portrait and similar tablets included) that leaves too
// little room for the content to be usable, so those get the single-pane
// "mobile" layout (overlay sidebar/backlinks, bottom tab bar) instead —
// it was already built to work at a range of widths, just under a name
// that undersells it: this flag really means "not enough room for three
// permanent panes," not "phone."
export const MOBILE_QUERY = "(max-width: 1023px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => (typeof window === "undefined" ? false : window.matchMedia(MOBILE_QUERY).matches));

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
