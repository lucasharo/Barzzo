import * as React from "react";
import { cn } from "@barzzo/utilitarios";
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variante?: "info" | "sucesso" | "alerta" | "erro";
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variante = "info", children, ...props }, ref) => {
    const icones = {
      info: <Info className="h-5 w-5 text-[#2563EB] shrink-0" />,
      sucesso: <CheckCircle2 className="h-5 w-5 text-[#16A34A] shrink-0" />,
      alerta: <AlertTriangle className="h-5 w-5 text-[#EAB308] shrink-0" />,
      erro: <AlertCircle className="h-5 w-5 text-[#DC2626] shrink-0" />,
    };

    const estilos = {
      info: "border-[#2563EB]/40 bg-[#2563EB]/10 text-black dark:text-white",
      sucesso: "border-[#16A34A]/40 bg-[#16A34A]/10 text-black dark:text-white",
      alerta: "border-[#EAB308]/40 bg-[#EAB308]/10 text-black dark:text-white",
      erro: "border-[#DC2626]/40 bg-[#DC2626]/10 text-black dark:text-white",
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative w-full rounded-lg border p-4 flex items-start gap-3 text-sm",
          estilos[variante],
          className
        )}
        {...props}
      >
        {icones[variante]}
        <div className="flex-1">{children}</div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

export const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm opacity-90 leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";
