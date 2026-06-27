import Icon from "./Icon";

export default function EmptyState({
  icon = "inbox",
  title,
  subtitle,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-on-surface-variant">
      <span className="text-5xl">
        <Icon name={icon} />
      </span>
      <p className="text-lg font-semibold text-on-surface">{title}</p>
      {subtitle && <p className="text-sm">{subtitle}</p>}
    </div>
  );
}
