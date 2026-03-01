interface PageHeaderProps {
  title: string
  subtitle: string
}

export const PageHeader = ({ title, subtitle }: PageHeaderProps) => (
  <div className="space-y-3">
    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-gold">Operations Overview</p>
    <h1 className="font-heading text-3xl font-semibold tracking-tight text-text md:text-4xl">{title}</h1>
    <p className="max-w-3xl text-sm leading-relaxed text-textMuted md:text-base">{subtitle}</p>
  </div>
)
