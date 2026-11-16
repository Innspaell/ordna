"use client";

import { useEffect } from "react";
import { logOpen } from "@/app/actions/usage";
import { osloToday } from "@/lib/quick-add/parse";

const KEY = "ordna:sist-apnet";

/** Logger «åpnet» én gang per dag per enhet. Feiler stille: brukslogg skal aldri stoppe appen. */
export function UsageBeacon() {
  useEffect(() => {
    try {
      const today = osloToday();
      if (localStorage.getItem(KEY) === today) return;
      localStorage.setItem(KEY, today);
      logOpen().catch(() => {});
    } catch {
      // localStorage kan mangle (privat modus); da logger vi ikke
    }
  }, []);
  return null;
}
