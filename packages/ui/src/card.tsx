import * as React from "react";
import { cn } from "@barzzo/utilitarios";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  camada?: "primaria" | "secundaria" | "terciaria";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, camada = "primaria", ...props }, ref) => {
    const camadas = {
      primaria: "bg-[#F6F6F7] dark:bg-[#141416] border border-neutral-200/60 dark:border-neutral-800/60",
      secundaria: "bg-[#EEEEF0] dark:bg-[#1C1C1F] border border-neutral-200/80 dark:border-neutral-800/80",
      terciaria: "bg-[#E5E5E8] dark:bg-[#252529] border border-neutral-300 dark:border-neutral-700",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl shadow-sm text-black dark:text-white transition-colors",
          camadas[camada],
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-bold leading-none tracking-tight text-black dark:text-white",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-sm font-normal text-black/70 dark:text-white/70",
      className
    )}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
