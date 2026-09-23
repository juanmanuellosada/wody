"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RevenueViewSelectorView } from "@/components/finance/RevenueViewSelectorView";
import type { RevenueView } from "@/components/finance/revenue-view-contracts";

export type { RevenueView } from "@/components/finance/revenue-view-contracts";

interface Props {
  view: RevenueView;
}

/** Production URL adapter for the controlled revenue-view selector. */
export function RevenueViewSelector({ view }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function handleSelect(next: RevenueView) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "alumnos") params.delete("revenueView");
    else params.set("revenueView", next);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  return <RevenueViewSelectorView view={view} onSelect={handleSelect} />;
}
