"use client";

import { useMemo, useState } from "react";

/* ---------- helpers ---------- */

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

function clampPct(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function fmtDuration(min) {
  const m = Math.max(0, min || 0);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm} min`;
  return `${h}h ${String(mm).padStart(2, "0")}min`;
}

function fmtDistanceGlobal(m) {
  if (!m) return "—";
  return `${(m / 1000).toFixed(1)} km`;
}

function fmtDistanceForActivity(activity, distanceM) {
  if (!distanceM) return "—";
  const unit = activity?.distance_unit ?? "km";
  if (unit === "m") return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
}

function pct(done, planned) {
  if (!planned || planned <= 0) return 0;
  return clampPct((done / planned) * 100);
}

/* ---------- donut builder ---------- */
function buildDonut(activitiesStats, totalMinutes) {
  const size = 112;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const C = 2 * Math.PI * radius;

  const hasData = totalMinutes > 0 && activitiesStats.length > 0;
  if (!hasData) {
    return { size, stroke, radius, C, segments: [], centerLabel: "—" };
  }

  let offset = 0;
  const segments = activitiesStats
    .filter((a) => a.minutes > 0)
    .map((a) => {
      const frac = a.minutes / totalMinutes;
      const dash = frac * C;
      const seg = {
        id: a.id,
        color: a.color,
        dasharray: `${dash} ${C - dash}`,
        dashoffset: -offset,
        title: `${a.name} — ${Math.round(frac * 100)}% (${fmtDuration(a.minutes)})`,
      };
      offset += dash;
      return seg;
    });

  return {
    size,
    stroke,
    radius,
    C,
    segments,
    centerLabel: `${Math.round((totalMinutes / 60) * 10) / 10}h`,
  };
}

/* ---------- tiny UI primitives ---------- */

function GlassCard({ className = "", children }) {
  return (
    <div
      className={[
        "rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl",
        "shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Segmented({ value, onChange, items = [] }) {
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={[
              "px-3 py-1.5 text-xs sm:text-sm transition",
              active ? "bg-white text-black" : "text-white/70 hover:text-white",
            ].join(" ")}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- main component ---------- */

export default function WeeklySummary({
  workoutsByDate,
  activities,
  weekDays,
  goals = { minutes: 300, workouts: 4 },
}) {
  const [donutMode, setDonutMode] = useState("planned"); // planned | done
  const [dayMode, setDayMode] = useState("planned"); // planned | done

  const activityMap = useMemo(
    () => new Map((activities ?? []).map((a) => [a.id, a])),
    [activities]
  );

  const allWorkouts = useMemo(() => {
    return (weekDays ?? []).flatMap((d) => {
      const key = toISO(d);
      return workoutsByDate?.[key] ?? [];
    });
  }, [weekDays, workoutsByDate]);

  const computed = useMemo(() => {
    const totalWorkoutsPlanned = allWorkouts.length;

    // planned totals
    const plannedMinutes = allWorkouts.reduce((sum, w) => sum + (w.duration_min ?? 0), 0);
    const plannedDistanceM = allWorkouts.reduce((sum, w) => sum + (w.distance_m ?? 0), 0);

    // done totals (only if checked)
    const doneWorkouts = allWorkouts.filter((w) => !!w.done);
    const totalWorkoutsDone = doneWorkouts.length;

    const doneMinutes = doneWorkouts.reduce((sum, w) => {
      const real = w.actual_duration_min ?? w.duration_min ?? 0;
      return sum + real;
    }, 0);

    const doneDistanceM = doneWorkouts.reduce((sum, w) => {
      const real = w.actual_distance_m ?? w.distance_m ?? 0;
      return sum + real;
    }, 0);

    // by activity (planned + done)
    const byActivity = {};
    for (const w of allWorkouts) {
      const act = w.activity || activityMap.get(w.activity_id);
      if (!act) continue;
      const id = act.id ?? w.activity_id;

      if (!byActivity[id]) {
        byActivity[id] = {
          id,
          name: act.name ?? "Activité",
          color: act.color ?? "#999999",
          unit: act.distance_unit ?? "km",
          planned: { minutes: 0, distance: 0, workouts: 0 },
          done: { minutes: 0, distance: 0, workouts: 0 },
        };
      }

      byActivity[id].planned.minutes += w.duration_min ?? 0;
      byActivity[id].planned.distance += w.distance_m ?? 0;
      byActivity[id].planned.workouts += 1;

      if (w.done) {
        byActivity[id].done.minutes += w.actual_duration_min ?? w.duration_min ?? 0;
        byActivity[id].done.distance += w.actual_distance_m ?? w.distance_m ?? 0;
        byActivity[id].done.workouts += 1;
      }
    }

    const activitiesStatsPlanned = Object.values(byActivity)
      .map((a) => ({ id: a.id, name: a.name, color: a.color, minutes: a.planned.minutes }))
      .sort((a, b) => b.minutes - a.minutes);

    const activitiesStatsDone = Object.values(byActivity)
      .map((a) => ({ id: a.id, name: a.name, color: a.color, minutes: a.done.minutes }))
      .sort((a, b) => b.minutes - a.minutes);

    const activityRows = Object.values(byActivity).sort(
      (a, b) => (b.planned.minutes - a.planned.minutes) || (b.done.minutes - a.done.minutes)
    );

    // volume by day (planned + done)
    const byDay = (weekDays ?? []).map((d) => {
      const key = toISO(d);
      const ws = workoutsByDate?.[key] ?? [];
      const planned = ws.reduce((sum, w) => sum + (w.duration_min ?? 0), 0);
      const done = ws
        .filter((w) => !!w.done)
        .reduce((sum, w) => sum + (w.actual_duration_min ?? w.duration_min ?? 0), 0);
      return { date: key, planned, done };
    });

    return {
      totalWorkoutsPlanned,
      plannedMinutes,
      plannedDistanceM,
      totalWorkoutsDone,
      doneMinutes,
      doneDistanceM,
      activityRows,
      activitiesStatsPlanned,
      activitiesStatsDone,
      byDay,
    };
  }, [allWorkouts, weekDays, workoutsByDate, activityMap]);

  const goalMinutes = goals?.minutes ?? 300;
  const goalWorkouts = goals?.workouts ?? 4;

  const pctGoalMinutes = goalMinutes ? clampPct((computed.doneMinutes / goalMinutes) * 100) : 0;
  const pctGoalWorkouts = goalWorkouts ? clampPct((computed.totalWorkoutsDone / goalWorkouts) * 100) : 0;

  const pctPlannedVsDoneMinutes = pct(computed.doneMinutes, computed.plannedMinutes);
  const pctPlannedVsDoneDistance = pct(computed.doneDistanceM, computed.plannedDistanceM);
  const pctPlannedVsDoneWorkouts = pct(computed.totalWorkoutsDone, computed.totalWorkoutsPlanned);

  const donut =
    donutMode === "planned"
      ? buildDonut(computed.activitiesStatsPlanned, computed.plannedMinutes)
      : buildDonut(computed.activitiesStatsDone, computed.doneMinutes);

  const dayLetters = ["L", "M", "M", "J", "V", "S", "D"];
  const maxDay = Math.max(
    ...computed.byDay.map((d) => (dayMode === "planned" ? d.planned : d.done)),
    1
  );

  return (
    <section className="mt-10 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-white/90">Résumé</h2>
          <p className="text-sm text-white/55">Prévu vs Réalisé ✅</p>
        </div>
        <div className="text-xs text-white/45">
          (Réalisé = séances cochées ✅ • “réel” si rempli)
        </div>
      </div>

      {/* ===== Top row ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Prévu vs Réalisé */}
        <GlassCard className="p-5">
          <p className="text-sm text-white/60">Prévu vs Réalisé</p>

          <div className="mt-4 space-y-4">
            {/* Temps */}
            <div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white/90">Temps</p>
                  <p className="text-xs text-white/50">
                    Prévu {fmtDuration(computed.plannedMinutes)} • Réalisé {fmtDuration(computed.doneMinutes)}
                  </p>
                </div>
                <div className="text-sm font-semibold text-white/90">
                  {Math.round(pctPlannedVsDoneMinutes)}%
                </div>
              </div>
              <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full bg-white"
                  style={{ width: `${pctPlannedVsDoneMinutes}%` }}
                />
              </div>
            </div>

            {/* Distance */}
            <div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white/90">Distance</p>
                  <p className="text-xs text-white/50">
                    Prévu {fmtDistanceGlobal(computed.plannedDistanceM)} • Réalisé {fmtDistanceGlobal(computed.doneDistanceM)}
                  </p>
                </div>
                <div className="text-sm font-semibold text-white/90">
                  {Math.round(pctPlannedVsDoneDistance)}%
                </div>
              </div>
              <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full bg-white"
                  style={{ width: `${pctPlannedVsDoneDistance}%` }}
                />
              </div>
            </div>

            {/* Séances */}
            <div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white/90">Séances</p>
                  <p className="text-xs text-white/50">
                    Prévu {computed.totalWorkoutsPlanned} • Réalisé {computed.totalWorkoutsDone}
                  </p>
                </div>
                <div className="text-sm font-semibold text-white/90">
                  {Math.round(pctPlannedVsDoneWorkouts)}%
                </div>
              </div>
              <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full bg-white"
                  style={{ width: `${pctPlannedVsDoneWorkouts}%` }}
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-white/40 mt-4">
            Réalisé = séances cochées ✅. Distance/temps “réel” si rempli, sinon prévu.
          </p>
        </GlassCard>

        {/* Donut + toggle */}
        <GlassCard className="p-5 flex items-center gap-5">
          <div className="relative shrink-0">
            <svg width={donut.size} height={donut.size} viewBox={`0 0 ${donut.size} ${donut.size}`}>
              <circle
                cx={donut.size / 2}
                cy={donut.size / 2}
                r={donut.radius}
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={donut.stroke}
              />
              {donut.segments.map((s) => (
                <circle
                  key={s.id}
                  cx={donut.size / 2}
                  cy={donut.size / 2}
                  r={donut.radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={donut.stroke}
                  strokeDasharray={s.dasharray}
                  strokeDashoffset={s.dashoffset}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${donut.size / 2} ${donut.size / 2})`}
                >
                  <title>{s.title}</title>
                </circle>
              ))}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-xs text-white/55">{donutMode === "planned" ? "Prévu" : "Réalisé"}</div>
              <div className="text-xl font-semibold text-white/90">{donut.centerLabel}</div>
            </div>
          </div>

          <div className="min-w-0 w-full">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white/90">Répartition</p>
                <p className="text-sm text-white/55">Minutes par sport</p>
              </div>

              <Segmented
                value={donutMode}
                onChange={setDonutMode}
                items={[
                  { value: "planned", label: "Prévu" },
                  { value: "done", label: "Réalisé" },
                ]}
              />
            </div>

            <div className="mt-3 space-y-2">
              {(donutMode === "planned" ? computed.activitiesStatsPlanned : computed.activitiesStatsDone)
                .slice(0, 4)
                .map((a) => {
                  const total = donutMode === "planned" ? computed.plannedMinutes : computed.doneMinutes;
                  const p = total ? Math.round((a.minutes / total) * 100) : 0;
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: a.color }} />
                        <span className="truncate text-white/85">{a.name}</span>
                      </div>
                      <span className="text-white/55 whitespace-nowrap">{p}%</span>
                    </div>
                  );
                })}

              {(donutMode === "planned" ? computed.plannedMinutes : computed.doneMinutes) === 0 ? (
                <p className="text-sm text-white/45">Aucune séance</p>
              ) : null}
            </div>
          </div>
        </GlassCard>

        {/* Objectifs (réalisé) */}
        <GlassCard className="p-5">
          <p className="text-sm text-white/60">Objectifs semaine</p>

          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/75">Temps (réalisé)</span>
              <span className="text-white/85">
                {fmtDuration(computed.doneMinutes)} / {fmtDuration(goalMinutes)}
              </span>
            </div>
            <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-2 rounded-full bg-white" style={{ width: `${pctGoalMinutes}%` }} />
            </div>
            <p className="text-xs text-white/45 mt-1">{Math.round(pctGoalMinutes)}%</p>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/75">Séances (réalisé)</span>
              <span className="text-white/85">
                {computed.totalWorkoutsDone} / {goalWorkouts}
              </span>
            </div>
            <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-2 rounded-full bg-white" style={{ width: `${pctGoalWorkouts}%` }} />
            </div>
            <p className="text-xs text-white/45 mt-1">{Math.round(pctGoalWorkouts)}%</p>
          </div>

          <p className="text-xs text-white/40 mt-4">(Objectifs personnalisables plus tard.)</p>
        </GlassCard>
      </div>

      {/* ===== Par activité : prévu ET réalisé ===== */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-white/90">Charge par activité</h3>
          <span className="text-xs text-white/45">Prévu (planning) vs Réalisé (✅)</span>
        </div>

        <div className="mt-4 space-y-4">
          {computed.activityRows.length === 0 ? (
            <p className="text-sm text-white/45">Aucune séance cette semaine</p>
          ) : (
            computed.activityRows.map((a) => {
              const plannedPct = computed.plannedMinutes
                ? Math.round((a.planned.minutes / computed.plannedMinutes) * 100)
                : 0;

              const donePct = computed.doneMinutes
                ? Math.round((a.done.minutes / computed.doneMinutes) * 100)
                : 0;

              const ratioDoneOfPlanned = pct(a.done.minutes, a.planned.minutes);

              return (
                <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: a.color }} />
                      <span className="font-medium truncate text-white/90">{a.name}</span>

                      <span className="text-xs text-white/45 whitespace-nowrap">
                        • prévu {a.planned.workouts} • fait {a.done.workouts}
                      </span>
                    </div>

                    <div className="text-xs text-white/55 text-right whitespace-nowrap">
                      <div>Prévu : {fmtDuration(a.planned.minutes)} • {plannedPct}%</div>
                      <div>Réalisé : {fmtDuration(a.done.minutes)} • {donePct}%</div>
                    </div>
                  </div>

                  {/* Barres : prévu (couleur) + réalisé (blanc) */}
                  <div className="mt-3 space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-xs text-white/45">
                        <span>Prévu</span>
                        <span>{fmtDistanceForActivity(activityMap.get(a.id), a.planned.distance)}</span>
                      </div>
                      <div className="mt-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${plannedPct}%`, backgroundColor: a.color }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs text-white/45">
                        <span>Réalisé</span>
                        <span>{fmtDistanceForActivity(activityMap.get(a.id), a.done.distance)}</span>
                      </div>
                      <div className="mt-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-white"
                          style={{ width: `${ratioDoneOfPlanned}%` }}
                          title="Réalisé / Prévu (temps)"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-white/35">
                        (Barre blanche = % du prévu réalisé, basé sur le temps)
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </GlassCard>

      {/* ===== Volume par jour ===== */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-white/90">Volume par jour</h3>

          <Segmented
            value={dayMode}
            onChange={setDayMode}
            items={[
              { value: "planned", label: "Prévu" },
              { value: "done", label: "Réalisé" },
            ]}
          />
        </div>

        <div className="mt-4 flex items-end gap-2 h-28">
          {computed.byDay.map((d, i) => {
            const minutes = dayMode === "planned" ? d.planned : d.done;
            const heightPct = (minutes / maxDay) * 100;

            return (
              <div key={d.date} className="flex-1 flex flex-col items-center">
                <div
                  title={`${dayLetters[i]} — ${fmtDuration(minutes)}`}
                  className={[
                    "w-full rounded-t transition",
                    minutes === 0 ? "bg-white/10" : "bg-white/30 hover:bg-white/45",
                  ].join(" ")}
                  style={{ height: `${heightPct}%` }}
                />
                <span className="text-xs mt-2 text-white/60">{dayLetters[i]}</span>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-white/40 mt-3">
          Astuce : survole une barre pour voir le total du jour.
        </p>
      </GlassCard>
    </section>
  );
}