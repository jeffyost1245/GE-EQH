"use client";

// Without a crew cookie the data layer can't know whose records to load,
// and every query fails looking like a dead network. Send the phone back
// to the login screen instead, which is the actual fix.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { currentCrew } from "@/lib/tenant";

export default function CrewGuard() {
  const router = useRouter();

  useEffect(() => {
    if (!currentCrew()) router.replace("/login");
  }, [router]);

  return null;
}
