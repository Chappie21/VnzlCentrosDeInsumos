import { forwardRef, useId } from "react";
import type { TextareaHTMLAttributes } from "react";
import Icon from "./Icon";

type TextAreaFieldProps = {
  label: string;
  icon?: string;
  error?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField({ label, icon, error, rows = 3, ...rest }, ref) {
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
          {icon && (
            <div className="pointer-events-none absolute left-0 top-0 flex items-center pl-3 pt-3 text-on-surface-variant">
              <Icon name={icon} />
            </div>
          )}
          <textarea
            id={id}
            ref={ref}
            rows={rows}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`block w-full rounded-lg border-2 bg-surface py-3 pr-3 text-base text-on-surface transition-colors placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-safety focus:border-safety ${
              icon ? "pl-10" : "pl-3"
            } ${error ? "border-emergency" : "border-outline-variant"}`}
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
  },
);

export default TextAreaField;
