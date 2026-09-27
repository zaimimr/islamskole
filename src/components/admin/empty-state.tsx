import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  headingLevel = "h2",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <div
      className={cn(
        "flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B] [&_svg]:size-6">
          {icon}
        </span>
      ) : null}
      <Heading className="mt-4 font-heading text-xl font-bold">{title}</Heading>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-admin-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
