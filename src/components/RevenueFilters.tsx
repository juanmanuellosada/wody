"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RevenueFiltersView } from "@/components/finance/RevenueFiltersView";
import type { PaymentMethod } from "@/lib/payment-stats";

interface Props {
  current: { from: string; to: string; methodIds: PaymentMethod[]; categoryId: string };
  /** Si se pasa, muestra el filtro de categoría (solo la vista Productos lo usa). */
  categories?: { id: string; name: string }[];
}

/** Production URL adapter for the controlled product and mixed filter presentation. */
export function RevenueFilters({ current, categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function navigate(overrides: Record<string, string | string[]>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (Array.isArray(value)) {
        const joined = value.filter(Boolean).join(",");
        if (joined) params.set(key, joined);
        else params.delete(key);
      } else if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function toggleMethod(method: PaymentMethod) {
    const next = current.methodIds.includes(method)
      ? current.methodIds.filter((candidate) => candidate !== method)
      : [...current.methodIds, method];
    navigate({ statsMethods: next });
  }

  return (
    <RevenueFiltersView
      current={current}
      categories={categories}
      onFromChange={(date) => navigate({ statsFrom: date })}
      onToChange={(date) => navigate({ statsTo: date })}
      onMethodToggle={toggleMethod}
      onCategoryChange={(categoryId) => navigate({ statsCategoryId: categoryId })}
    />
  );
}
