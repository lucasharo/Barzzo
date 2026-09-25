import * as React from "react";
import { cn } from "@barzzo/utilitarios";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  obrigatorio?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, obrigatorio, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-sm font-medium leading-none text-black dark:text-white select-none inline-flex items-center gap-1",
          className
        )}
        {...props}
      >
        {children}
        {obrigatorio && <span className="text-[#DC2626]">*</span>}
      </label>
    );
  }
);

Label.displayName = "Label";
