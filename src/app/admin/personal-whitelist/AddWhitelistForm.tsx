"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToWhitelist } from "@/actions/personal-whitelist";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function AddWhitelistForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addToWhitelist({ email, note });
      if (result.ok) {
        setEmail("");
        setNote("");
        setFeedback({ ok: true, msg: "Email agregado." });
        router.refresh();
      } else {
        const msg =
          result.error === "duplicate"
            ? "Ese email ya está en la whitelist."
            : result.error;
        setFeedback({ ok: false, msg });
      }
      setTimeout(() => setFeedback(null), 5000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isPending}
            placeholder="usuario@ejemplo.com"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Input
            label="Nota (opcional)"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isPending}
            placeholder="Contexto / origen"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" size="sm" loading={isPending}>
            Agregar
          </Button>
        </div>
      </div>
      {feedback && (
        <p
          className={[
            "text-xs font-heading font-bold uppercase tracking-wide",
            feedback.ok ? "text-green-400" : "text-brand-red",
          ].join(" ")}
          role="alert"
        >
          {feedback.msg}
        </p>
      )}
    </form>
  );
}
