import Link from "next/link";

export function DemoBanner() {
  return (
    <div className="bg-[#E31414] text-white text-center py-2 px-4">
      <p className="text-xs font-heading font-bold uppercase tracking-[0.15em]">
        Modo Demo —{" "}
        <Link href="/demo" className="underline hover:no-underline">
          Cambiar rol
        </Link>{" "}
        —{" "}
        <Link href="/" className="underline hover:no-underline">
          Volver al inicio
        </Link>
      </p>
    </div>
  );
}
