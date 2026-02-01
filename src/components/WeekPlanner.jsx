"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import WorkoutCard from "@/components/WorkoutCard";

/* ---------------- utils ---------------- */

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function inferSport(activity) {
  const name = (activity?.name || "").toLowerCase();
  if (name.includes("vélo") || name.includes("velo") || name.includes("bike")) return "bike";
  if (name.includes("natation") || name.includes("swim")) return "swim";
  return "run";
}

function isTodayISO(dayKey) {
  return dayKey === toISODate(new Date());
}

function dedupeWorkoutsById(items) {
  const seen = new Set();
  const out = [];
  for (const w of items ?? []) {
    const id = String(w?.id ?? "");
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(w);
  }
  return out;
}

/* ---------------- UI helpers ---------------- */

function DayColumn({ dayKey, className = "", children }) {
  const { setNodeRef, isOver } = useDroppable({ id: String(dayKey) });

  return (
    <div
      ref={setNodeRef}
      className={[
        className,
        // drop feedback (doesn't affect layout)
        isOver ? "ring-2 ring-white/30" : "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function SortableWorkoutCard({ workout, onOpenDetail, onToggleDone }) {
  const wid = String(workout.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: wid });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const color = workout.activity?.color ?? "#8b8b8b";
  const sport = inferSport(workout.activity);

  return (
    <div ref={setNodeRef} style={style}>
      <WorkoutCard
        title={workout.title || workout.activity?.name || "Séance"}
        sport={sport}
        distanceM={workout.distance_m}
        color={color}
        done={!!workout.done}
        onOpen={() => onOpenDetail?.(workout)}
        onToggleDone={() => onToggleDone?.(workout)}
        dragProps={{
          setNodeRef,
          attributes,
          listeners,
          isDragging,
        }}
      />
    </div>
  );
}

/* ---------------- Main ---------------- */

export default function WeekPlanner({
  weekDays,
  workoutsByDate,
  dayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],

  restDay = null, // "mon".."sun"
  dayKeyToDow = null, // fn(isoDate) => "mon".."sun"

  onAdd,
  onOpenDetail,
  onToggleDone,
  onMoveWorkout,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 220, tolerance: 6 },
    })
  );

  const weekDayKeys = weekDays.map((d) => toISODate(d));

  function findDayKeyByWorkoutIdWithinWeek(id) {
    const target = String(id);
    for (const dayKey of weekDayKeys) {
      const items = workoutsByDate?.[dayKey] ?? [];
      if (items.some((w) => String(w.id) === target)) return dayKey;
    }
    return null;
  }

  async function onDragEnd(event) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const fromDayKey = findDayKeyByWorkoutIdWithinWeek(activeId);
    const toDayKey = findDayKeyByWorkoutIdWithinWeek(overId) || overId;

    if (!fromDayKey || !weekDayKeys.includes(toDayKey)) return;

    await onMoveWorkout?.({
      activeId,
      overId,
      fromDayKey,
      toDayKey,
      weekDayKeys,
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {/* ✅ 16px gap everywhere */}
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-4">
        {weekDays.map((d, i) => {
          const dayKey = weekDayKeys[i];
          const rawItems = workoutsByDate?.[dayKey] ?? [];
          const items = dedupeWorkoutsById(rawItems);

          const dayNum = d.getDate();
          const dow = dayKeyToDow ? dayKeyToDow(dayKey) : null;
          const isRest = restDay && dow && dow === restDay;
          const isToday = isTodayISO(dayKey);

          return (
            <DayColumn
              key={dayKey}
              dayKey={dayKey}
              className={[
                // ✅ radius 24px
                "relative rounded-[24px] overflow-hidden",
                "min-h-[240px] flex flex-col",
                "border border-white/10 bg-white/[0.06] backdrop-blur-xl",
                "shadow-[0_18px_70px_rgba(0,0,0,0.40)]",

                // ✅ hover: only this column changes (transform doesn't reflow)
                "transition-transform duration-200 ease-out",
                "hover:scale-[1.01]",
                "hover:border-white/15",

                // ✅ today: slightly more present, no layout shift
                isToday
                  ? "bg-white/[0.09] border-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_18px_70px_rgba(0,0,0,0.45)]"
                  : "",

                // padding is fixed (no hover padding changes => no layout jump)
                "p-4",
              ].join(" ")}
            >
              {/* ✅ header centered top */}
              <div className="text-center">
                <div className="text-[12px] leading-[13px] font-semibold text-white/85">
                  {dayLabels[i]}{" "}
                  <span className="text-white/55 font-semibold">({dayNum})</span>
                </div>

                {isToday ? (
                  <div className="mt-2 flex justify-center">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-white/15 bg-white/10 text-white/85">
                      Aujourd’hui
                    </span>
                  </div>
                ) : null}
              </div>

              {/* ✅ Rest day: pill centered in the column */}
              {isRest ? (
                <div className="flex-1 flex items-start justify-center pt-4">
                  <div
                    className="
                      rounded-[8px] px-4 py-2
                      border border-white/15
                      bg-white/10 backdrop-blur
                      text-white/85
                      shadow-[0_10px_28px_rgba(0,0,0,0.35)]
                      text-[12px] font-semibold
                      flex items-center gap-2
                    "
                    title="Jour de repos"
                  >
                    <span aria-hidden="true">😴</span>
                    <span>Repos</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-4 space-y-2">
                    <SortableContext
                      items={items.map((w) => String(w.id))}
                      strategy={verticalListSortingStrategy}
                    >
                      {items.length === 0 ? (
                        <p className="text-[12px] text-white/55 text-center">
                          Aucun entrainement
                        </p>
                      ) : (
                        items.map((w) => (
                          <SortableWorkoutCard
                            key={String(w.id)}
                            workout={w}
                            onOpenDetail={onOpenDetail}
                            onToggleDone={onToggleDone}
                          />
                        ))
                      )}
                    </SortableContext>
                  </div>

                  {/* ✅ Add button: opacity only (no layout change) */}
                  <div className="mt-auto pt-4 flex justify-center">
                    <button
                      onClick={() => onAdd?.(d)}
                      className={[
                        "opacity-0 group-hover:opacity-100 hover:opacity-100",
                        "transition-opacity duration-200",
                        "px-3 py-2 rounded-xl",
                        "bg-white/10 hover:bg-white/15",
                        "border border-white/10",
                        "text-sm text-white/85",
                        "flex items-center gap-2",
                      ].join(" ")}
                      type="button"
                    >
                      <span className="text-lg leading-none">＋</span>
                      <span>Ajouter</span>
                    </button>
                  </div>
                </>
              )}
            </DayColumn>
          );
        })}
      </div>
    </DndContext>
  );
}