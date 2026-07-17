"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

const allowedEvents = new Set(["profile_view", "directory_search", "source_click", "save_created", "alert_created", "digest_return"]);

function capture(event: string, properties: Record<string, string> = {}) {
  if (!allowedEvents.has(event) || window.localStorage.getItem("workindex_analytics_consent") !== "granted") return;
  void fetch("/api/v1/analytics", {
    method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
    body: JSON.stringify({ event, properties }),
  });
}

function AnalyticsEffects() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    if (pathname.startsWith("/companies/")) capture("profile_view", { path: pathname });
    if (pathname === "/gcc") capture("directory_search", { path: pathname, query: search.toString() });
  }, [pathname, search]);
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-analytics-event]");
      if (target?.dataset.analyticsEvent) capture(target.dataset.analyticsEvent, { label: target.dataset.analyticsLabel ?? "" });
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
  return null;
}

export function AnalyticsProvider() {
  return <Suspense><AnalyticsEffects /></Suspense>;
}
