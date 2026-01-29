"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function NavItem({ href, label, active }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-4 py-2 text-sm transition select-none",
        active ? "text-black bg-white rounded-full shadow-sm" : "text-white/70 hover:text-white"
      )}
    >
      {label}
    </Link>
  );
}

export default function HeaderBar({ onLogout }) {
  const pathname = usePathname();

  const items = [
    { href: "/dashboard", label: "Ma semaine" },
    { href: "/calendar", label: "Planifier" },
    { href: "/activities", label: "Mes activités" },
    { href: "/stats", label: "Stats" },
  ];

  return (
    <div className="w-full flex justify-center">
      <div
        className={cn(
          "inline-flex items-center",
          "rounded-full border border-white/10 bg-white/[0.06] backdrop-blur-xl",
          "shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_16px_40px_rgba(0,0,0,0.35)]"
        )}
      >
        <div className="flex items-center p-1">
          {items.map((it, idx) => {
            const active = pathname === it.href;
            return (
              <div key={it.href} className="flex items-center">
                <NavItem href={it.href} label={it.label} active={active} />
                {idx !== items.length - 1 ? (
                  <div className="mx-1 h-6 w-[2px] bg-white/10 rounded-full" />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mx-1 h-7 w-[2px] bg-white/10 rounded-full" />

        <Link
          href="/profile"
          className={cn(
            "px-4 py-2 text-sm text-white/70 hover:text-white transition select-none"
          )}
        >
          Mon profil
        </Link>

        <div className="mx-1 h-7 w-[2px] bg-white/10 rounded-full" />

        <button
          type="button"
          onClick={onLogout}
          title="Se déconnecter"
          className={cn(
            "p-2 mx-2 rounded-full",
            "text-white/75 hover:text-white",
            "hover:bg-white/10 transition"
          )}
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}