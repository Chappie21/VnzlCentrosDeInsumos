import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import Icon from "./Icon";

type FieldProps = {
  label: string;
  icon: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>;

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, icon, error, type = "text", ...rest },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant"
      >
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-on-surface-variant">
          <Icon name={icon} />
        </div>
        <input
          id={id}
          type={type}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`block w-full rounded-lg border-2 bg-surface py-3 pl-10 pr-3 text-base text-on-surface transition-colors placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-safety focus:border-safety ${
            error ? "border-emergency" : "border-outline-variant"
          }`}
          {...rest}
        />
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-emergency">
          {error}
        </p>
      )}
    </div>
  );
});

export default Field;
