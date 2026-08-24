import type { MDXComponents } from "mdx/types";
import Link from "next/link";

/**
 * Estilos de los artículos del blog. Van acá y no en una hoja aparte para que
 * el .mdx sea markdown puro: el que escribe no tiene que acordarse de ninguna
 * clase de Tailwind. No usamos @tailwindcss/typography a propósito — es una
 * dependencia más para replicar el mismo look oscuro que ya tiene el sitio.
 */
const components: MDXComponents = {
  h2: ({ children }) => (
    <h2 className="text-xl sm:text-2xl font-heading font-black uppercase tracking-[0.05em] text-white mt-14 mb-4">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-heading font-bold text-white mt-9 mb-3">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-[15px] text-gray-300 font-body leading-relaxed mb-5">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="flex flex-col gap-2.5 mb-6 pl-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="flex flex-col gap-2.5 mb-6 pl-5 list-decimal marker:text-brand-red">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-[15px] text-gray-300 font-body leading-relaxed">
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong className="text-white font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="text-gray-200 italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-brand-red pl-5 my-8 text-[15px] text-gray-400 font-body italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-white/10 my-12" />,
  table: ({ children }) => (
    <div className="overflow-x-auto my-8 border border-white/[0.08]">
      <table className="w-full text-left border-collapse min-w-[520px]">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="p-3.5 text-xs font-heading font-bold uppercase tracking-[0.12em] text-gray-500 bg-white/[0.03] border-b border-white/[0.08]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="p-3.5 text-sm text-gray-300 font-body border-t border-white/[0.06] align-top">
      {children}
    </td>
  ),
  a: ({ href, children }) => {
    const url = href ?? "#";
    const esInterno = url.startsWith("/");
    if (esInterno) {
      return (
        <Link
          href={url}
          className="text-white underline underline-offset-2 hover:text-brand-red transition-colors"
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-white underline underline-offset-2 hover:text-brand-red transition-colors"
      >
        {children}
      </a>
    );
  },
};

export function useMDXComponents(): MDXComponents {
  return components;
}
