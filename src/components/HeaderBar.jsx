"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function NavRow({ href, label, active, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "h-11 px-3 rounded-2xl flex items-center justify-between",
        "transition",
        "outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        active
          ? "bg-white/12 border border-white/12 text-white"
          : "text-white/80 hover:text-white hover:bg-white/8 border border-transparent"
      )}
    >
      <span className="text-[14px] font-semibold">{label}</span>
      {active ? (
        <span className="text-[11px] text-white/60 font-semibold">Actif</span>
      ) : null}
    </Link>
  );
}

export default function HeaderBar({ onLogout }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const panelRef = useRef(null);

  const items = useMemo(
    () => [
      { href: "/dashboard", label: "Ma semaine" },
      { href: "/calendar", label: "Planifier" },
      { href: "/activities", label: "Mes activités" },
      { href: "/stats", label: "Stats" },
    ],
    []
  );

  const activeLabel = useMemo(() => {
    const match =
      items.find((x) => x.href === pathname)?.label ||
      (pathname === "/profile" ? "Mon profil" : "Menu");
    return match;
  }, [items, pathname]);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Click outside
  useEffect(() => {
    function onDown(e) {
      if (!open) return;
      const el = panelRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setOpen(false);
    }
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    // ✅ Sticky + glass (Apple-ish)
    <div className="sticky top-0 z-40">
      {/* petite couche de “fade” derrière, iOS-like */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/30 to-transparent" />

      <div className="w-full flex justify-center px-4 pt-4">
        {/* DESKTOP (≥ sm) : on garde ton pill nav */}
        <div
          className={cn(
            "hidden sm:inline-flex items-center",
            "rounded-full border border-white/10 bg-white/[0.06] backdrop-blur-xl",
            "shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_16px_40px_rgba(0,0,0,0.35)]"
          )}
        >
          <div className="flex items-center p-1">
            {items.map((it, idx) => {
              const active = pathname === it.href;
              return (
                <div key={it.href} className="flex items-center">
                  <Link
                    href={it.href}
                    className={cn(
                      "px-4 py-2 text-sm transition select-none",
                      active
                        ? "text-black bg-white rounded-full shadow-sm"
                        : "text-white/70 hover:text-white"
                    )}
                  >
                    {it.label}
                  </Link>

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
            className="px-4 py-2 text-sm text-white/70 hover:text-white transition select-none"
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

        {/* MOBILE (< sm) : burger + titre centré + logout */}
        <div
          className={cn(
            "sm:hidden w-full max-w-6xl",
            "rounded-[20px] border border-white/10 bg-white/[0.06] backdrop-blur-xl",
            "shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_16px_40px_rgba(0,0,0,0.35)]"
          )}
        >
          <div className="h-12 px-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Ouvrir le menu"
              onClick={() => setOpen((v) => !v)}
              className={cn(
                "h-10 w-10 rounded-xl",
                "border border-white/10 bg-white/6",
                "flex items-center justify-center",
                "text-white/85 hover:text-white hover:bg-white/10 transition",
                "outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              )}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div className="min-w-0 px-2 text-center">
              <div className="text-[13px] font-semibold text-white/90 truncate">
                {activeLabel}
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              title="Se déconnecter"
              className={cn(
                "h-10 w-10 rounded-xl",
                "border border-white/10 bg-white/6",
                "flex items-center justify-center",
                "text-white/85 hover:text-white hover:bg-white/10 transition",
                "outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              )}
            >
              <LogOut size={18} />
            </button>
          </div>

          {/* PANEL + BACKDROP (anim “fade + slide”) */}
          <div
            className={cn(
              "relative overflow-hidden",
              "transition-[max-height] duration-200 ease-out",
              open ? "max-h-[420px]" : "max-h-0"
            )}
          >
            <div
              ref={panelRef}
              className={cn(
                "px-3 pb-3",
                "transition-all duration-200 ease-out",
                open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
              )}
            >
              <div
                className={cn(
                  "rounded-[20px] border border-white/10 bg-white/8 backdrop-blur-xl",
                  "shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
                  "p-2"
                )}
              >
                <div className="space-y-2">
                  {items.map((it) => {
                    const active = pathname === it.href;
                    return (
                      <NavRow
                        key={it.href}
                        href={it.href}
                        label={it.label}
                        active={active}
                        onClick={() => setOpen(false)}
                      />
                    );
                  })}

                  <div className="h-px bg-white/10 my-1" />

                  <NavRow
                    href="/profile"
                    label="Mon profil"
                    active={pathname === "/profile"}
                    onClick={() => setOpen(false)}
                  />
                </div>
              </div>
            </div>

            {/* Backdrop clickable (dans le bloc sticky) */}
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
              className={cn(
                "absolute inset-0 -z-10",
                open ? "block" : "hidden"
              )}
              tabIndex={-1}
            />
          </div>
        </div>
      </div>
    </div>
  );
}