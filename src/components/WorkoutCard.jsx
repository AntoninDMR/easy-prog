"use client";

import { Check } from "lucide-react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function hexToRgba(hex, a = 0.16) {
  if (!hex || typeof hex !== "string") return `rgba(255,255,255,${a})`;
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return `rgba(255,255,255,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function formatDistance({ sport, distanceM }) {
  if (distanceM == null) return "—";
  if (sport === "swim") return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
}

export default function WorkoutCard({
  title,
  sport = "run",
  distanceM = null,
  color = "#8b8b8b",
  done = false,

  onOpen,
  onToggleDone,

  dragProps, // dnd-kit: { setNodeRef, attributes, listeners, isDragging }
  className = "",

  // ✅ flags pour garder 1 codebase avec DetailedWorkoutCard
  showStatusLine = false, // false => WorkoutCard simple
  statusLabel = null, // "Prévu" | "Réalisé" (si tu veux l'activer)
}) {
  const isDragging = !!dragProps?.isDragging;

  // ✅ même logique que DetailedWorkoutCard
  const bg = hexToRgba(color, 0.14);

  const distanceLabel = formatDistance({ sport, distanceM });

  return (
    <div
      ref={dragProps?.setNodeRef}
      {...(dragProps?.attributes ?? {})}
      {...(dragProps?.listeners ?? {})}
      className={cx(
        "w-full text-left group",
        "rounded-[8px] border border-white/10",
        "backdrop-blur-xl shadow-[0_18px_70px_rgba(0,0,0,0.40)]",
        "transition hover:-translate-y-[1px] hover:border-white/15",
        isDragging ? "opacity-70" : "opacity-100",
        className
      )}
      style={{ backgroundColor: bg }}
    >
      {/* ✅ padding identique */}
      <div className="p-4 sm:p-5">
        {/* header (copié) */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {/* ✅ checkbox : même placement/size que DetailedWorkoutCard */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleDone?.();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className={cx(
                  "h-4 w-4 rounded-[6px] border",
                  "bg-black/10 backdrop-blur",
                  "flex items-center justify-center",
                  done ? "border-white/35" : "border-white/18",
                  "transition hover:border-white/35"
                )}
                aria-label={done ? "Marquer comme non fait" : "Marquer comme fait"}
              >
                {done ? <Check className="h-3.5 w-3.5 text-white/90" /> : null}
              </button>

              {/* ✅ titre 12px bold/semibold comme ta detail card */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen?.();
                }}
                className="min-w-0 text-left"
              >
                <div className="text-[12px] font-semibold text-white/90 truncate">
                  {title || "Séance"}
                </div>
              </button>
            </div>

            {/* ✅ ligne secondaire : par défaut “distance only” */}
            {showStatusLine ? (
              <div className="mt-2 text-[11px] text-white/65">
                <span className="font-medium text-white/75">
                  {statusLabel ?? (done ? "Réalisé" : "Prévu")}
                </span>
                <span className="text-white/35"> — </span>
                <span>{distanceLabel}</span>
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-white/65">
                {distanceLabel}
              </div>
            )}
          </div>

          {/* ✅ dot couleur identique */}
          <div className="shrink-0">
            <div
              className="h-3.5 w-3.5 rounded-lg border border-white/15"
              style={{ backgroundColor: hexToRgba(color, 0.65) }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* ✅ GRABBER (sans overlay sur le contenu) */}
        {dragProps ? (
          <div
            className={cx(
              "overflow-hidden transition-all duration-200 ease-out",
              // desktop hover
              "max-h-0 opacity-0 mt-0",
              "group-hover:mt-4 group-hover:max-h-[48px] group-hover:opacity-100",
              // mobile: visible
              "[@media(hover:none)]:mt-4",
              "[@media(hover:none)]:max-h-[48px]",
              "[@media(hover:none)]:opacity-100"
            )}
          >
            <div className="flex justify-center">
              <div
                className={cx(
                  "rounded-2xl px-3 py-2",
                  "border border-white/10 bg-white/10 backdrop-blur",
                  "shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
                )}
                aria-hidden="true"
              >
                <div className="flex flex-col items-center gap-[3px]">
                  <div className="h-[2px] w-10 rounded-full bg-white/55" />
                  <div className="h-[2px] w-10 rounded-full bg-white/40" />
                  <div className="h-[2px] w-10 rounded-full bg-white/28" />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}