"use client";

import * as React from "react";
import { cn } from "@barzzo/utilitarios";

export interface BottomNavProps {
  children: React.ReactNode;
  className?: string;
}

export function BottomNav({ children, className }: BottomNavProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex justify-center pointer-events-none"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <nav
        className={cn(
          "pointer-events-auto flex items-center justify-around gap-1 px-3 py-1.5 rounded-[28px] bg-[#111112]/95 dark:bg-[#111112]/97 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] border border-white/[0.06] mx-4 w-full max-w-sm",
          className
        )}
        aria-label="Navegação inferior móvel"
      >
        {children}
      </nav>
    </div>
  );
}

export interface BottomNavItemProps {
  icone: React.ComponentType<{ className?: string }>;
  rotulo: string;
  ativo?: boolean;
  onClick?: () => void;
  badge?: string | number;
  className?: string;
  asLink?: boolean;
}

export const BottomNavItem = React.forwardRef<
  HTMLButtonElement,
  BottomNavItemProps
>(({ icone: Icone, rotulo, ativo = false, onClick, badge, className }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      style={{ WebkitTapHighlightColor: "transparent" }}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 px-2 min-h-[52px] min-w-[52px] rounded-2xl transition-colors select-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 active:outline-none border-0 ring-0",
        ativo
          ? "text-[#E8734A]"
          : "text-neutral-400 hover:text-white",
        className
      )}
    >
      <div className="relative">
        <Icone
          className={cn(
            "h-5 w-5 transition-transform",
            ativo && "scale-110"
          )}
        />
        {badge !== undefined && (
          <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#B45A2B] px-1 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      <span className="text-[11px] leading-tight tracking-tight text-center truncate max-w-[64px]">
        {rotulo}
      </span>
    </button>
  );
});

BottomNavItem.displayName = "BottomNavItem";
