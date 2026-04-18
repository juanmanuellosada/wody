import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean;
}

function Card({ accent = false, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={[
        "bg-elev",
        accent ? "border-l-2 border-brand-red" : "border border-edge",
        "p-4",
        "transition-colors duration-200",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

function CardHeader({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["mb-3 pb-3 border-b border-edge", className].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

function CardTitle({ className = "", children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={[
        "text-sm font-heading font-bold uppercase tracking-[0.15em] text-white",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </h3>
  );
}

function CardBody({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

export { Card, CardHeader, CardTitle, CardBody };
export type { CardProps };
