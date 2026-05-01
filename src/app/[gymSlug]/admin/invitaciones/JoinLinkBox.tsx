"use client";

import { useState } from "react";

interface Props {
  gymSlug: string;
}

export function JoinLinkBox({ gymSlug }: Props) {
  const url = `https://www.wody.com.ar/${gymSlug}/invitarme`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border border-line bg-panel p-4 mb-6 flex flex-col sm:flex-row gap-2 sm:items-center">
      <div className="flex-1">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1">
          Link público para que los alumnos se den de alta:
        </p>
        <input
          type="text"
          value={url}
          readOnly
          className="w-full bg-elev border border-edge px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-brand-red/50"
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
      <button
        type="button"
        onClick={copy}
        className="px-4 py-2 bg-brand-red text-white text-xs font-heading font-bold uppercase tracking-[0.15em] hover:bg-brand-red-dark transition-colors duration-200 flex-shrink-0"
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
