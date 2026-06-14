import { Blob, DottedArc, WaveDivider } from "./decor";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

export function PageHeader({ eyebrow, title, subtitle }: PageHeaderProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-secondary/45 via-background to-background">
      <Blob className="-top-20 -right-16 h-64 w-64 text-primary/12 animate-float" />
      <DottedArc className="bottom-12 left-6 hidden h-24 w-24 text-primary/15 sm:block" />
      <div className="section-shell relative flex flex-col items-center gap-4 pt-16 pb-20 text-center sm:pt-20">
        {eyebrow ? <span className="eyebrow animate-rise">{eyebrow}</span> : null}
        <h1 className="max-w-3xl text-4xl leading-tight font-bold text-balance-pretty animate-rise [animation-delay:60ms] sm:text-5xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="max-w-2xl text-lg text-muted-foreground text-balance-pretty animate-rise [animation-delay:120ms] sm:text-xl">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="text-card">
        <WaveDivider flip />
      </div>
    </section>
  );
}
