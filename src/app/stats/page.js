"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import HeaderBar from "@/components/HeaderBar";
import { ChevronLeft, ChevronRight } from "lucide-react";

/* ---------------- utils dates ---------------- */

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function toISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=dim,1=lun...
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endExclusiveFromStart(start, view) {
  if (view === "week") return addDays(start, 7);
  if (view === "month") return addMonths(start, 1);
  return addYears(start, 1);
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfYear(date) {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function addYears(date, n) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + n);
  return d;
}

function clampPct(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function minutesToNice(min) {
  const m = Math.max(0, Math.round(min || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${String(r).padStart(2, "0")}`;
}

function kmNice(km) {
  const n = Number(km || 0);
  return n.toFixed(n >= 10 ? 0 : 1);
}

function pctChange(cur, prev) {
  const c = Number(cur || 0);
  const p = Number(prev || 0);
  if (p === 0 && c === 0) return 0;
  if (p === 0) return 100;
  return ((c - p) / p) * 100;
}

function periodLabel(view, start) {
  if (view === "week") {
    const end = addDays(start, 6);
    const s = start.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    const e = end.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    return `Semaine du ${s} au ${e}`;
  }
  if (view === "month") {
    return start.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }
  return start.toLocaleDateString("fr-FR", { year: "numeric" });
}

function dayNameFR(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long" });
}

/* ---------------- UI ---------------- */

function Segmented({ value, onChange }) {
  const items = [
    { k: "week", label: "Semaine" },
    { k: "month", label: "Mois" },
    { k: "year", label: "Année" },
  ];

  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
      {items.map((it) => {
        const active = value === it.k;
        return (
          <button
            key={it.k}
            type="button"
            onClick={() => onChange(it.k)}
            className={cx(
              "px-3 py-1.5 text-sm rounded-full transition",
              active ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function GlassCard({ className = "", children }) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl",
        "shadow-[0_20px_80px_rgba(0,0,0,0.45)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <GlassCard className="p-4">
      <div className="text-sm text-white/60">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub ? <div className="text-xs text-white/45 mt-1">{sub}</div> : null}
    </GlassCard>
  );
}

function DiffRow({ label, planned, done, unit, pctDone }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-white/80">{label}</div>
          <div className="mt-1 text-xs text-white/50">
            Prévu {planned} {unit} • Réalisé {done} {unit}
          </div>
        </div>
        <div className="text-sm font-semibold">{Math.round(pctDone)}%</div>
      </div>

      <div className="mt-3">
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-2 rounded-full bg-white"
            style={{ width: `${clampPct(pctDone)}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] text-white/40">
          (Réalisé = séances cochées ✅. Valeurs “réelles” si remplies.)
        </div>
      </div>
    </div>
  );
}

function BarRow({ label, color, valueText, pct }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium truncate text-white/85">{label}</span>
        </div>
        <div className="text-sm text-white/70 whitespace-nowrap">{valueText}</div>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-2 rounded-full"
          style={{ width: `${clampPct(pct)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function StatsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState("");

  const [view, setView] = useState("week"); // week | month | year
  const [cursor, setCursor] = useState(() => new Date()); // période courante (déplacable)
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const { range, prevRange, rangeLabel } = useMemo(() => {
    const base = new Date(cursor);

    let start;
    if (view === "week") start = startOfWeekMonday(base);
    else if (view === "month") start = startOfMonth(base);
    else start = startOfYear(base);

    const end = endExclusiveFromStart(start, view);

    const prevStart =
      view === "week" ? addDays(start, -7) : view === "month" ? addMonths(start, -1) : addYears(start, -1);
    const prevEnd = start;

    return {
      range: { start, end },
      prevRange: { start: prevStart, end: prevEnd },
      rangeLabel: periodLabel(view, start),
    };
  }, [view, cursor]);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
    }
    init();
  }, [router]);

  async function fetchWorkouts(uid, start, end) {
    const from = toISODate(start);
    const to = toISODate(addDays(end, -1)); // inclusif côté date

    const { data, error } = await supabase
      .from("workouts")
      .select(
        "id, workout_date, duration_min, distance_m, done, actual_duration_min, actual_distance_m, activity:activities(id,name,color,distance_unit)"
      )
      .eq("user_id", uid)
      .gte("workout_date", from)
      .lte("workout_date", to);

    if (error) throw error;
    return data ?? [];
  }

  function computeStats(workouts) {
    const plannedSessions = workouts.length;

    const doneWorkouts = workouts.filter((w) => !!w.done);
    const doneSessions = doneWorkouts.length;

    let plannedMin = 0;
    let plannedKm = 0;

    let doneMin = 0;
    let doneKm = 0;

    // group by activity
    const byActPlanned = new Map(); // key -> {name,color,min,km}
    const byActDone = new Map();
    const byDayDoneMin = new Map(); // date -> min (done)

    for (const w of workouts) {
      const actName = w.activity?.name ?? "Autre";
      const actColor = w.activity?.color ?? "#999999";
      const key = w.activity?.id ? `id:${w.activity.id}` : `name:${actName}`;

      const pMin = w.duration_min ?? 0;
      const pKm = w.distance_m != null ? w.distance_m / 1000 : 0;

      plannedMin += pMin;
      plannedKm += pKm;

      const curP = byActPlanned.get(key) ?? { name: actName, color: actColor, min: 0, km: 0 };
      curP.min += pMin;
      curP.km += pKm;
      byActPlanned.set(key, curP);

      if (w.done) {
        const rMin = w.actual_duration_min ?? w.duration_min ?? 0;
        const rKm =
          (w.actual_distance_m ?? w.distance_m) != null ? (w.actual_distance_m ?? w.distance_m) / 1000 : 0;

        doneMin += rMin;
        doneKm += rKm;

        const curD = byActDone.get(key) ?? { name: actName, color: actColor, min: 0, km: 0 };
        curD.min += rMin;
        curD.km += rKm;
        byActDone.set(key, curD);

        const dayKey = w.workout_date;
        byDayDoneMin.set(dayKey, (byDayDoneMin.get(dayKey) ?? 0) + rMin);
      }
    }

    const avgPlannedMin = plannedSessions ? plannedMin / plannedSessions : 0;
    const avgDoneMin = doneSessions ? doneMin / doneSessions : 0;

    const avgPlannedKm = plannedSessions ? plannedKm / plannedSessions : 0;
    const avgDoneKm = doneSessions ? doneKm / doneSessions : 0;

    const distTimePlanned = Array.from(byActPlanned.values()).sort((a, b) => b.min - a.min);
    const distTimeDone = Array.from(byActDone.values()).sort((a, b) => b.min - a.min);

    // insights (done)
    let busiestDay = null;
    let busiestMin = 0;
    for (const [day, m] of byDayDoneMin.entries()) {
      if (m > busiestMin) {
        busiestMin = m;
        busiestDay = day;
      }
    }

    const mainSportPlanned = distTimePlanned[0]?.name ?? "—";
    const mainSportDone = distTimeDone[0]?.name ?? "—";

    return {
      plannedSessions,
      plannedMin,
      plannedKm,
      avgPlannedMin,
      avgPlannedKm,

      doneSessions,
      doneMin,
      doneKm,
      avgDoneMin,
      avgDoneKm,

      distTimePlanned,
      distTimeDone,

      busiestDay,
      busiestMin,

      mainSportPlanned,
      mainSportDone,
    };
  }

  useEffect(() => {
    if (!userId) return;

    async function load() {
      setLoading(true);
      setErrorMsg("");
      try {
        const curW = await fetchWorkouts(userId, range.start, range.end);
        const prevW = await fetchWorkouts(userId, prevRange.start, prevRange.end);

        const curS = computeStats(curW);
        const prevS = computeStats(prevW);

        setStats({
          cur: curS,
          prev: prevS,
          delta: {
            plannedMinPct: pctChange(curS.plannedMin, prevS.plannedMin),
            doneMinPct: pctChange(curS.doneMin, prevS.doneMin),

            plannedKmPct: pctChange(curS.plannedKm, prevS.plannedKm),
            doneKmPct: pctChange(curS.doneKm, prevS.doneKm),

            plannedSessionsPct: pctChange(curS.plannedSessions, prevS.plannedSessions),
            doneSessionsPct: pctChange(curS.doneSessions, prevS.doneSessions),
          },
        });
      } catch (e) {
        setErrorMsg(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [userId, range.start, range.end, prevRange.start, prevRange.end]);

  const cur = stats?.cur;
  const delta = stats?.delta;

  function goPrev() {
    setCursor((c) => {
      const d = new Date(c);
      if (view === "week") return addDays(d, -7);
      if (view === "month") return addMonths(d, -1);
      return addYears(d, -1);
    });
  }

  function goNext() {
    setCursor((c) => {
      const d = new Date(c);
      if (view === "week") return addDays(d, 7);
      if (view === "month") return addMonths(d, 1);
      return addYears(d, 1);
    });
  }

  function goToday() {
    setCursor(new Date());
  }

  const pctDoneMin = cur?.plannedMin ? (cur.doneMin / cur.plannedMin) * 100 : 0;
  const pctDoneKm = cur?.plannedKm ? (cur.doneKm / cur.plannedKm) * 100 : 0;
  const pctDoneSessions = cur?.plannedSessions ? (cur.doneSessions / cur.plannedSessions) * 100 : 0;

  return (
    <main className="min-h-screen px-6 py-10 text-white">
      {/* background dark + glow */}
      <div className="fixed inset-0 -z-10 bg-[#070A12]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(900px_500px_at_15%_10%,rgba(120,119,198,0.22),transparent_60%),radial-gradient(900px_500px_at_85%_10%,rgba(56,189,248,0.16),transparent_60%),radial-gradient(900px_500px_at_50%_85%,rgba(34,197,94,0.10),transparent_60%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_35%,rgba(0,0,0,0.35))]" />

      <div className="mb-6">
        <HeaderBar onLogout={handleLogout} />
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Statistiques</h1>
            <p className="text-white/55 mt-1">{email}</p>
            <p className="text-white/70 mt-4 font-medium">{rangeLabel}</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            <Segmented
              value={view}
              onChange={(v) => {
                setView(v);
                // recale le curseur pour éviter les périodes bizarres
                setCursor(new Date());
              }}
            />

            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                className="w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur flex items-center justify-center"
                aria-label="Période précédente"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="px-3 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur text-sm text-white/80"
              >
                Today
              </button>
              <button
                type="button"
                onClick={goNext}
                className="w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur flex items-center justify-center"
                aria-label="Période suivante"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <GlassCard className="mt-8 p-6">
            <p className="text-white/60">Chargement…</p>
          </GlassCard>
        ) : errorMsg ? (
          <GlassCard className="mt-8 p-6 border-red-400/20 bg-red-500/10">
            <p className="text-red-200 text-sm">Erreur: {errorMsg}</p>
          </GlassCard>
        ) : !cur ? (
          <GlassCard className="mt-8 p-6">
            <p className="text-white/60">Pas de données.</p>
          </GlassCard>
        ) : (
          <>
            {/* PREVU vs REALISE */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white/60">Prévu vs Réalisé</div>
                    <div className="mt-1 text-lg font-semibold">Objectifs de période</div>
                  </div>
                  <span className="text-xs text-white/50">✅ = cochées</span>
                </div>

                <div className="mt-5 space-y-3">
                  <DiffRow
                    label="Temps"
                    planned={minutesToNice(cur.plannedMin)}
                    done={minutesToNice(cur.doneMin)}
                    unit=""
                    pctDone={pctDoneMin}
                  />
                  <DiffRow
                    label="Distance"
                    planned={kmNice(cur.plannedKm)}
                    done={kmNice(cur.doneKm)}
                    unit="km"
                    pctDone={pctDoneKm}
                  />
                  <DiffRow
                    label="Séances"
                    planned={cur.plannedSessions}
                    done={cur.doneSessions}
                    unit=""
                    pctDone={pctDoneSessions}
                  />
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <div className="text-sm text-white/60">Prévu</div>
                <div className="mt-1 text-lg font-semibold">Synthèse planning</div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <StatCard
                    label="Temps total"
                    value={minutesToNice(cur.plannedMin)}
                    sub={`vs période précédente: ${delta.plannedMinPct >= 0 ? "+" : ""}${delta.plannedMinPct.toFixed(0)}%`}
                  />
                  <StatCard
                    label="Distance totale"
                    value={`${kmNice(cur.plannedKm)} km`}
                    sub={`vs période précédente: ${delta.plannedKmPct >= 0 ? "+" : ""}${delta.plannedKmPct.toFixed(0)}%`}
                  />
                  <StatCard
                    label="Séances"
                    value={`${cur.plannedSessions}`}
                    sub={`vs période précédente: ${delta.plannedSessionsPct >= 0 ? "+" : ""}${delta.plannedSessionsPct.toFixed(0)}%`}
                  />
                  <StatCard label="Sport principal" value={cur.mainSportPlanned} />
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <div className="text-sm text-white/60">Réalisé</div>
                <div className="mt-1 text-lg font-semibold">Synthèse exécution</div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <StatCard
                    label="Temps total"
                    value={minutesToNice(cur.doneMin)}
                    sub={`vs période précédente: ${delta.doneMinPct >= 0 ? "+" : ""}${delta.doneMinPct.toFixed(0)}%`}
                  />
                  <StatCard
                    label="Distance totale"
                    value={`${kmNice(cur.doneKm)} km`}
                    sub={`vs période précédente: ${delta.doneKmPct >= 0 ? "+" : ""}${delta.doneKmPct.toFixed(0)}%`}
                  />
                  <StatCard
                    label="Séances"
                    value={`${cur.doneSessions}`}
                    sub={`vs période précédente: ${delta.doneSessionsPct >= 0 ? "+" : ""}${delta.doneSessionsPct.toFixed(0)}%`}
                  />
                  <StatCard label="Sport principal" value={cur.mainSportDone} />
                </div>
              </GlassCard>
            </div>

            {/* INSIGHTS */}
            <div className="mt-6">
              <GlassCard className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/60">Insights</div>
                    <div className="mt-1 text-lg font-semibold">Ce qui ressort</div>
                  </div>
                  <div className="text-xs text-white/50">Basé sur le réalisé (✅)</div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-white/50 text-xs">Jour le plus chargé</div>
                    <div className="font-semibold mt-1">
                      {cur.busiestDay
                        ? `${dayNameFR(cur.busiestDay)} (${minutesToNice(cur.busiestMin)})`
                        : "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-white/50 text-xs">Tendance volume</div>
                    <div className="font-semibold mt-1">
                      {delta.doneMinPct >= 0 ? "↗" : "↘"} {delta.doneMinPct >= 0 ? "+" : ""}
                      {delta.doneMinPct.toFixed(0)}% (temps)
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-white/50 text-xs">Taux de réalisation</div>
                    <div className="font-semibold mt-1">
                      {Math.round(pctDoneSessions)}% des séances • {Math.round(pctDoneMin)}% du temps
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* DISTRIBUTIONS */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white/60">Répartition</div>
                    <div className="mt-1 text-lg font-semibold">Prévu par sport (temps)</div>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {cur.distTimePlanned.length === 0 ? (
                    <p className="text-white/60 text-sm">Pas de données.</p>
                  ) : (
                    cur.distTimePlanned.map((a) => (
                      <BarRow
                        key={`p-${a.name}`}
                        label={a.name}
                        color={a.color}
                        valueText={minutesToNice(a.min)}
                        pct={cur.plannedMin ? (a.min / cur.plannedMin) * 100 : 0}
                      />
                    ))
                  )}
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white/60">Répartition</div>
                    <div className="mt-1 text-lg font-semibold">Réalisé par sport (temps)</div>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {cur.distTimeDone.length === 0 ? (
                    <p className="text-white/60 text-sm">Pas de données (séances non cochées).</p>
                  ) : (
                    cur.distTimeDone.map((a) => (
                      <BarRow
                        key={`d-${a.name}`}
                        label={a.name}
                        color={a.color}
                        valueText={minutesToNice(a.min)}
                        pct={cur.doneMin ? (a.min / cur.doneMin) * 100 : 0}
                      />
                    ))
                  )}
                </div>
              </GlassCard>
            </div>
          </>
        )}
      </div>
    </main>
  );
}