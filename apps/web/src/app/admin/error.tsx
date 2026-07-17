"use client";

import { useEffect } from "react";
import { AdminErrorState } from "@/components/admin/admin-states";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("WorkIndex admin route error", error);
  }, [error]);

  return <AdminErrorState reset={reset} />;
}

