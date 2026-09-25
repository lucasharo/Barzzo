"use client";

import * as React from "react";
import { cn } from "@barzzo/utilitarios";

export interface BottomNavProps {
  children: React.ReactNode;
  className?: string;
}

export function BottomNav({ children, className }: BottomNavProps) {
  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-neutral-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-[#0A0A0B]/95 backdrop-blur-md px-2 py-1 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] md:hidden shadow-lg",
        className
      )}
      aria-label="Navegação inferior móvel"
    >
      {children}
    </nav>
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
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-1 py-1 px-1 min-h-[48px] min-w-[48px] rounded-lg transition-colors select-none",
        ativo
          ? "text-[#B45A2B] font-semibold"
          : "text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white",
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
