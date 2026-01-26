"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

function Separator() {
  return <div className="w-[2px] h-6 bg-gray-200" />;
}

function NavItem({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-4 py-2 text-sm font-semibold transition",
        "relative",
        active
          ? "text-black"
          : "text-gray-500 hover:text-black",
      ].join(" ")}
    >
      {label}
      {/* underline actif */}
      <span
        className={[
          "absolute left-2 right-2 -bottom-[6px] h-[2px] transition",
          active ? "bg-black" : "bg-transparent",
        ].join(" ")}
      />
    </button>
  );
}

export default function HeaderBar({ onLogout }) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path) => pathname?.startsWith(path);

  return (
    <div className="w-full flex justify-center">
      {/* ✅ barre limitée en largeur */}
      <div className="w-full max-w-4xl">
        <div className="bg-white border rounded-md px-4 h-14 flex items-center justify-between shadow-sm">
          {/* ✅ boutons + separators */}
          <div className="flex items-center">
            <NavItem
              label="Ma semaine"
              active={isActive("/dashboard")}
              onClick={() => router.push("/dashboard")}
            />
            <Separator />
            <NavItem
              label="Activités"
              active={isActive("/activities")}
              onClick={() => router.push("/activities")}
            />
            <Separator />
            <NavItem
              label="Calendrier"
              active={isActive("/calendar")}
              onClick={() => router.push("/calendar")}
            />
            <Separator />
            <NavItem
              label="Profil"
              active={isActive("/profile")}
              onClick={() => router.push("/profile")}
            />
          </div>

          {/* ✅ logout = icône seule */}
          <button
            type="button"
            title="Se déconnecter"
            onClick={onLogout}
            className="text-gray-500 hover:text-black transition"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}