import * as React from "react";
import { cn } from "@barzzo/utilitarios";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  erro?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, erro, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg px-3.5 py-2 text-base transition-colors",
          "bg-[#F6F6F7] text-black border border-[#E5E5E8] placeholder:text-neutral-400",
          "dark:bg-[#1C1C1F] dark:text-white dark:border-[#252529] dark:placeholder:text-neutral-500",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45A2B] focus-visible:border-transparent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          erro && "border-[#DC2626] dark:border-[#DC2626] focus-visible:ring-[#DC2626]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
