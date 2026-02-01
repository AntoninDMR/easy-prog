"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import HeaderBar from "@/components/HeaderBar";
import WeekPlanner from "@/components/WeekPlanner";

/* ---------------- utils dates ---------------- */

function formatFRShort(date) {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
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

function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Convertit un ISO yyyy-mm-dd en clé "mon".."sun"
function dayKeyToDow(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[d.getDay()];
}

function hhmmToMinutes(hhmm) {
  if (!hhmm) return null;
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToHHMM(min) {
  if (min == null) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ---------------- tiny helpers ---------------- */

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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

function metersToPretty(activity, meters) {
  if (meters == null) return "—";
  return activity?.distance_unit === "m"
    ? `${meters} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

function minsToPretty(min) {
  if (min == null) return "—";
  // volontairement compact
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function safeNum(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function pctDelta(curr, prev) {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function formatPct(p) {
  const s = p >= 0 ? "+" : "";
  return `${s}${Math.round(p)}%`;
}

/* ---------------- Modal ---------------- */

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-5 text-white">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button
            className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-white/80"
            onClick={onClose}
            type="button"
          >
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Donut ---------------- */

function Donut({ label, value, total, footerLeft, footerRight }) {
  const size = 92;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const safeTotal = Math.max(0, total ?? 0);
  const safeValue = clamp(value ?? 0, 0, safeTotal || 1);
  const ratio = safeTotal === 0 ? 0 : safeValue / safeTotal;

  const dash = c * ratio;
  const gap = c - dash;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-4 shadow-[0_18px_70px_rgba(0,0,0,0.40)]">
      <div className="text-[12px] font-semibold text-white/85">{label}</div>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.78)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[18px] font-semibold text-white/90 leading-none">
              {safeTotal === 0 ? "—" : Math.round(ratio * 100) + "%"}
            </div>
            <div className="text-[11px] text-white/55 mt-1">
              {safeValue}/{safeTotal}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[12px] text-white/70">{footerLeft}</div>
          <div className="text-[12px] text-white/70 mt-1">{footerRight}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Detailed workout card (Today/Tomorrow) ---------------- */

function DetailedWorkoutCard({ workout, onOpen }) {
  const a = workout.activity;
  const color = a?.color ?? "#8b8b8b";
  const bg = hexToRgba(color, 0.14);

  const isDone = !!workout.done;

  // affichage principal = prévu OU réalisé (si done)
  const mainDuration = isDone ? workout.actual_duration_min : workout.duration_min;
  const mainDistance = isDone ? workout.actual_distance_m : workout.distance_m;

  const adv = workout.advanced ?? {};

  const chips = [
    adv.rpe != null ? { k: "RPE", v: String(adv.rpe) } : null,
    adv.avg_hr != null ? { k: "FC", v: String(adv.avg_hr) } : null,
    adv.elevation_m != null ? { k: "D+", v: `${adv.elevation_m}m` } : null,
  ].filter(Boolean);

  const title = workout.title || a?.name || "Séance";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        "w-full text-left group",
        "rounded-[8px] border border-white/10",
        "backdrop-blur-xl shadow-[0_18px_70px_rgba(0,0,0,0.40)]",
        "transition hover:-translate-y-[1px] hover:border-white/15"
      )}
      style={{ backgroundColor: bg }}
    >
      <div className="p-4 sm:p-5">
        {/* header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {/* petite checkbox (visuelle) */}
              <div
                className={cx(
                  "h-4 w-4 rounded-[6px] border",
                  "bg-black/10 backdrop-blur",
                  isDone ? "border-white/35" : "border-white/18"
                )}
                aria-hidden="true"
              >
                {isDone ? (
                  <div className="h-full w-full rounded-[6px] bg-white/70" />
                ) : null}
              </div>

              <div className="text-[12px] font-semibold text-white/90 truncate">
                {title}
              </div>
            </div>

            <div className="mt-2 text-[11px] text-white/65">
              <span className="font-medium text-white/75">
                {isDone ? "Réalisé" : "Prévu"}
              </span>
              <span className="text-white/35"> — </span>
              <span>{minsToPretty(mainDuration)}</span>
              <span className="text-white/35"> • </span>
              <span>{metersToPretty(a, mainDistance)}</span>
            </div>
          </div>

          <div className="shrink-0">
            <div
              className="h-3.5 w-3.5 rounded-lg border border-white/15"
              style={{ backgroundColor: hexToRgba(color, 0.65) }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* notes + advanced */}
        <div className="mt-3 space-y-2">
          {chips.length ? (
            <div className="flex flex-wrap gap-2">
              {chips.map((x) => (
                <span
                  key={x.k}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-white/12 bg-white/5 text-white/75"
                >
                  <span className="text-white/55">{x.k}</span>{" "}
                  <span className="font-semibold">{x.v}</span>
                </span>
              ))}
            </div>
          ) : null}

          {workout.notes ? (
            <div className="text-[11px] text-white/70 whitespace-pre-wrap line-clamp-4">
              {workout.notes}
            </div>
          ) : null}

          {isDone && workout.actual_notes ? (
            <div className="text-[11px] text-white/70 whitespace-pre-wrap line-clamp-4">
              <span className="font-semibold text-white/75">Notes réel :</span>{" "}
              {workout.actual_notes}
            </div>
          ) : null}
        </div>

        {/* subtle affordance */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-[11px] text-white/45">
            {isDone ? "Séance validée" : "Tap pour détails"}
          </div>

          <div className="text-[11px] text-white/55 opacity-0 group-hover:opacity-100 transition">
            Ouvrir →
          </div>
        </div>
      </div>
    </button>
  );
}

/* ---------------- Page ---------------- */

export default function DashboardPage() {
  const router = useRouter();

  const [userId, setUserId] = useState(null);

  const [activities, setActivities] = useState([]);
  const [workoutsByDate, setWorkoutsByDate] = useState({});
  const [restDay, setRestDay] = useState(null);

  // today / tomorrow block (indépendant de la semaine affichée)
  const [todayWorkouts, setTodayWorkouts] = useState([]);
  const [tomorrowWorkouts, setTomorrowWorkouts] = useState([]);

  // comparaison charge
  const [prevWeekWorkouts, setPrevWeekWorkouts] = useState([]);

  // semaine affichée
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // modals
  const [addOpen, setAddOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedWorkout, setSelectedWorkout] = useState(null);

  // add/edit form
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);
  const [createActivity, setCreateActivity] = useState(false);
  const [activityId, setActivityId] = useState("");

  const [newActName, setNewActName] = useState("");
  const [newActColor, setNewActColor] = useState("#22c55e");
  const [newActUnit, setNewActUnit] = useState("km");

  const [title, setTitle] = useState("");
  const [durationHHMM, setDurationHHMM] = useState("");
  const [distanceInput, setDistanceInput] = useState("");
  const [notes, setNotes] = useState("");

  const [advRpe, setAdvRpe] = useState("");
  const [advAvgHr, setAdvAvgHr] = useState("");
  const [advElevation, setAdvElevation] = useState("");

  // done modal (réalisé)
  const [doneWorkout, setDoneWorkout] = useState(null);
  const [actualDurationHHMM, setActualDurationHHMM] = useState("");
  const [actualDistanceInput, setActualDistanceInput] = useState("");
  const [actualNotes, setActualNotes] = useState("");

  function resetForm() {
    setEditingWorkoutId(null);
    setSelectedDate(null);
    setActivityId("");
    setDurationHHMM("");
    setDistanceInput("");
    setTitle("");
    setNotes("");
    setAdvRpe("");
    setAdvAvgHr("");
    setAdvElevation("");
    setCreateActivity(false);
    setNewActName("");
    setNewActColor("#22c55e");
    setNewActUnit("km");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function ensureDefaultActivities(uid) {
    const { data: existing, error } = await supabase
      .from("activities")
      .select("id")
      .eq("user_id", uid)
      .limit(1);

    if (error) return;

    if ((existing ?? []).length === 0) {
      await supabase.from("activities").insert([
        { user_id: uid, name: "Course", color: "#22c55e", distance_unit: "km" },
        { user_id: uid, name: "Vélo", color: "#f97316", distance_unit: "km" },
        { user_id: uid, name: "Natation", color: "#3b82f6", distance_unit: "m" },
      ]);
    }
  }

  async function fetchWorkoutsRange(uid, fromISO, toISO) {
    const { data, error } = await supabase
      .from("workouts")
      .select(
        "id, workout_date, position, activity_id, title, duration_min, distance_m, done, done_at, actual_duration_min, actual_distance_m, actual_notes, notes, advanced, activity:activities(id,name,color,distance_unit)"
      )
      .eq("user_id", uid)
      .gte("workout_date", fromISO)
      .lte("workout_date", toISO)
      .order("workout_date", { ascending: true })
      .order("position", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async function loadAll(uid) {
    // activities
    const { data: acts, error: actErr } = await supabase
      .from("activities")
      .select("id, name, color, distance_unit")
      .eq("user_id", uid)
      .order("name", { ascending: true });

    if (actErr) {
      alert("Erreur activités: " + actErr.message);
      return;
    }
    setActivities(acts ?? []);

    // week workouts (weekStart -> weekEnd)
    const from = toISODate(weekDays[0]);
    const to = toISODate(weekDays[6]);

    let weekWorkouts = [];
    try {
      weekWorkouts = await fetchWorkoutsRange(uid, from, to);
    } catch (e) {
      alert("Erreur entrainements: " + (e?.message ?? "unknown"));
      return;
    }

    const map = {};
    for (const w of weekWorkouts) {
      const key = w.workout_date;
      map[key] = map[key] ? [...map[key], w] : [w];
    }
    setWorkoutsByDate(map);

    // today / tomorrow (dates réelles, pas la semaine affichée)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayKey = toISODate(today);
    const tomorrowKey = toISODate(tomorrow);

    try {
      const [t0, t1] = await Promise.all([
        fetchWorkoutsRange(uid, todayKey, todayKey),
        fetchWorkoutsRange(uid, tomorrowKey, tomorrowKey),
      ]);
      setTodayWorkouts(t0);
      setTomorrowWorkouts(t1);
    } catch (e) {
      // pas bloquant
      console.warn("today/tomorrow fetch:", e?.message);
    }

    // prev week for delta
    const prevStart = new Date(weekDays[0]);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(weekDays[6]);
    prevEnd.setDate(prevEnd.getDate() - 7);

    try {
      const prev = await fetchWorkoutsRange(uid, toISODate(prevStart), toISODate(prevEnd));
      setPrevWeekWorkouts(prev);
    } catch (e) {
      console.warn("prev week fetch:", e?.message);
      setPrevWeekWorkouts([]);
    }
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }

      setUserId(data.user.id);

      // rest day
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("planning_prefs")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!pErr) {
        setRestDay(prof?.planning_prefs?.rest_day ?? null);
      }

      await ensureDefaultActivities(data.user.id);
      await loadAll(data.user.id);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, weekStart]);

  /* ---------------- interactions ---------------- */

  function openAddModal(dateObj) {
    resetForm();
    setSelectedDate(toISODate(dateObj));
    setAddOpen(true);
  }

  function openDetail(workout) {
    setSelectedWorkout(workout);
    setDetailOpen(true);
  }

  function openEditModal(workout) {
    resetForm();

    setEditingWorkoutId(workout.id);
    setSelectedDate(workout.workout_date);

    setCreateActivity(false);
    setActivityId(String(workout.activity_id ?? ""));

    setTitle(workout.title ?? "");
    setNotes(workout.notes ?? "");
    setDurationHHMM(minutesToHHMM(workout.duration_min));

    const unit = workout.activity?.distance_unit ?? "km";
    if (workout.distance_m == null) setDistanceInput("");
    else if (unit === "m") setDistanceInput(String(workout.distance_m));
    else setDistanceInput(String(workout.distance_m / 1000));

    const adv = workout.advanced ?? {};
    setAdvRpe(adv.rpe != null ? String(adv.rpe) : "");
    setAdvAvgHr(adv.avg_hr != null ? String(adv.avg_hr) : "");
    setAdvElevation(adv.elevation_m != null ? String(adv.elevation_m) : "");

    setAddOpen(true);
  }

  function autoTitle(act, durationMin, distanceM) {
    if (!act) return "Séance";
    const parts = [act.name];
    if (durationMin != null) parts.push(`${durationMin} min`);
    if (distanceM != null) {
      parts.push(act.distance_unit === "m" ? `${distanceM} m` : `${(distanceM / 1000).toFixed(1)} km`);
    }
    return parts.join(" — ");
  }

  async function createOrGetActivityId(uid) {
    if (!createActivity) return Number(activityId);

    const name = newActName.trim();
    if (!name) {
      alert("Nom de l’activité obligatoire");
      return null;
    }

    const { data, error } = await supabase
      .from("activities")
      .upsert([{ user_id: uid, name, color: newActColor, distance_unit: newActUnit }], {
        onConflict: "user_id,name",
      })
      .select("id, name, color, distance_unit")
      .single();

    if (error) {
      alert("Erreur création activité: " + error.message);
      return null;
    }

    setActivities((prev) => {
      const exists = prev.some((a) => a.id === data.id);
      const next = exists ? prev : [...prev, data];
      return next.sort((x, y) => x.name.localeCompare(y.name));
    });

    return data.id;
  }

  async function handleSaveWorkout() {
    if (!userId || !selectedDate) return;

    const actId = await createOrGetActivityId(userId);
    if (!actId) return;

    const act =
      activities.find((a) => a.id === actId) ||
      (createActivity ? { name: newActName, distance_unit: newActUnit } : null);

    const durationMin = hhmmToMinutes(durationHHMM);

    let distanceM = null;
    if (distanceInput !== "") {
      if ((act?.distance_unit ?? "km") === "m") {
        const n = Number(distanceInput);
        distanceM = Number.isNaN(n) ? null : Math.round(n);
      } else {
        const n = Number(distanceInput);
        distanceM = Number.isNaN(n) ? null : Math.round(n * 1000);
      }
    }

    const finalTitle = title.trim() ? title.trim() : autoTitle(act, durationMin, distanceM);

    const advanced = {
      ...(advRpe ? { rpe: Number(advRpe) } : {}),
      ...(advAvgHr ? { avg_hr: Number(advAvgHr) } : {}),
      ...(advElevation ? { elevation_m: Number(advElevation) } : {}),
    };

    if (editingWorkoutId) {
      const { error } = await supabase
        .from("workouts")
        .update({
          activity_id: actId,
          title: finalTitle,
          duration_min: durationMin,
          distance_m: distanceM,
          notes: notes.trim() || null,
          advanced,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingWorkoutId)
        .eq("user_id", userId);

      if (error) {
        alert("Erreur mise à jour: " + error.message);
        return;
      }

      await loadAll(userId);
      setAddOpen(false);
      setEditingWorkoutId(null);
      return;
    }

    const current = workoutsByDate[selectedDate] ?? [];
    const nextPosition = current.length;

    const { error } = await supabase.from("workouts").insert({
      user_id: userId,
      workout_date: selectedDate,
      activity_id: actId,
      title: finalTitle,
      duration_min: durationMin,
      distance_m: distanceM,
      notes: notes.trim() || null,
      advanced,
      position: nextPosition,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      alert("Erreur création séance: " + error.message);
      return;
    }

    setAddOpen(false);
    await loadAll(userId);
  }

  async function handleDeleteWorkout(id) {
    const { error } = await supabase.from("workouts").delete().eq("id", id).eq("user_id", userId);
    if (error) {
      alert("Erreur suppression: " + error.message);
      return;
    }

    setDetailOpen(false);
    setSelectedWorkout(null);
    await loadAll(userId);
  }

  /* ---------------- DONE flow (fix double modal) ---------------- */

  function openDoneModalFromDetail(workout) {
    // ✅ évite “2 modals empilées”
    setDetailOpen(false);
    setSelectedWorkout(null);

    setDoneWorkout(workout);
    setActualDurationHHMM(minutesToHHMM(workout.duration_min));
    setActualDistanceInput(workout.activity?.distance_unit === "m" ? String(workout.distance_m ?? "") : String((workout.distance_m ?? 0) / 1000 || ""));
    setActualNotes("");
    setDoneOpen(true);
  }

  async function confirmDone() {
    if (!doneWorkout || !userId) return;

    const act = doneWorkout.activity;

    const actualDurationMin = hhmmToMinutes(actualDurationHHMM);

    let actualDistanceM = null;
    if (actualDistanceInput !== "") {
      const n = Number(actualDistanceInput);
      if (!Number.isNaN(n)) {
        actualDistanceM = act?.distance_unit === "m" ? Math.round(n) : Math.round(n * 1000);
      }
    }

    const { error } = await supabase
      .from("workouts")
      .update({
        done: true,
        done_at: new Date().toISOString(),
        actual_duration_min: actualDurationMin,
        actual_distance_m: actualDistanceM,
        actual_notes: actualNotes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doneWorkout.id)
      .eq("user_id", userId);

    if (error) {
      alert("Erreur validation: " + error.message);
      return;
    }

    setDoneOpen(false);
    setDoneWorkout(null);
    await loadAll(userId);
  }

  async function undoDone(workout) {
    if (!userId) return;

    const { error } = await supabase
      .from("workouts")
      .update({
        done: false,
        done_at: null,
        actual_duration_min: null,
        actual_distance_m: null,
        actual_notes: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workout.id)
      .eq("user_id", userId);

    if (error) {
      alert("Erreur: " + error.message);
      return;
    }

    await loadAll(userId);
  }

  /* ---------------- DnD persist (WeekPlanner) ---------------- */

  async function handleMoveWorkout({ activeId, overId, fromDayKey, toDayKey }) {
    const fromItems = workoutsByDate[fromDayKey] ?? [];
    const toItems = workoutsByDate[toDayKey] ?? [];

    const activeIndex = fromItems.findIndex((w) => w.id === activeId);
    if (activeIndex === -1) return;

    const moved = fromItems[activeIndex];
    const newFrom = fromItems.filter((w) => w.id !== activeId);

    let newTo = [...toItems];
    const overIndexInTo = newTo.findIndex((w) => w.id === overId);
    const movedWithNewDate = { ...moved, workout_date: toDayKey };

    if (overIndexInTo === -1) newTo.push(movedWithNewDate);
    else newTo.splice(overIndexInTo, 0, movedWithNewDate);

    const reindexedFrom = newFrom.map((w, idx) => ({ ...w, position: idx }));
    const reindexedTo = newTo.map((w, idx) => ({ ...w, position: idx }));

    setWorkoutsByDate((prev) => ({
      ...prev,
      [fromDayKey]: reindexedFrom,
      [toDayKey]: reindexedTo,
    }));

    const updates = [];
    const newPos = reindexedTo.findIndex((w) => w.id === activeId);

    updates.push(
      supabase
        .from("workouts")
        .update({ workout_date: toDayKey, position: newPos, updated_at: new Date().toISOString() })
        .eq("id", activeId)
        .eq("user_id", userId)
    );

    for (const w of reindexedFrom) {
      updates.push(
        supabase
          .from("workouts")
          .update({ position: w.position, updated_at: new Date().toISOString() })
          .eq("id", w.id)
          .eq("user_id", userId)
      );
    }

    for (const w of reindexedTo) {
      if (w.id === activeId) continue;
      updates.push(
        supabase
          .from("workouts")
          .update({ position: w.position, updated_at: new Date().toISOString() })
          .eq("id", w.id)
          .eq("user_id", userId)
      );
    }

    const results = await Promise.all(updates);
    const anyError = results.find((r) => r.error)?.error;

    if (anyError) {
      alert("Erreur sauvegarde drag: " + anyError.message);
      await loadAll(userId);
    }
  }

  /* ---------------- computed stats ---------------- */

  const weekWorkoutsFlat = useMemo(() => {
    const out = [];
    for (const k of Object.keys(workoutsByDate)) {
      for (const w of workoutsByDate[k] ?? []) out.push(w);
    }
    return out;
  }, [workoutsByDate]);

  const stats = useMemo(() => {
    const plannedCount = weekWorkoutsFlat.length;
    const doneCount = weekWorkoutsFlat.filter((w) => !!w.done).length;

    const plannedMinutes = weekWorkoutsFlat.reduce((s, w) => s + safeNum(w.duration_min), 0);
    // ✅ pas de fallback : on ne prend QUE actual_duration_min
    const doneMinutes = weekWorkoutsFlat.reduce((s, w) => s + (w.done ? safeNum(w.actual_duration_min) : 0), 0);

    // charge par activité (planned minutes)
    const byAct = {};
    for (const w of weekWorkoutsFlat) {
      const id = w.activity?.id ?? w.activity_id ?? "unknown";
      const name = w.activity?.name ?? "Activité";
      const color = w.activity?.color ?? "#8b8b8b";
      byAct[id] = byAct[id] || { id, name, color, planned: 0, prev: 0 };
      byAct[id].planned += safeNum(w.duration_min);
    }

    // prev week aggregation
    const prevByAct = {};
    for (const w of prevWeekWorkouts) {
      const id = w.activity?.id ?? w.activity_id ?? "unknown";
      prevByAct[id] = (prevByAct[id] || 0) + safeNum(w.duration_min);
    }
    for (const id of Object.keys(byAct)) {
      byAct[id].prev = safeNum(prevByAct[id] || 0);
    }

    const acts = Object.values(byAct).sort((a, b) => b.planned - a.planned);

    const totalThis = acts.reduce((s, x) => s + x.planned, 0);
    const totalPrev = acts.reduce((s, x) => s + x.prev, 0);
    const deltaGlobal = pctDelta(totalThis, totalPrev);

    return {
      plannedCount,
      doneCount,
      plannedMinutes,
      doneMinutes,
      activities: acts,
      totalThis,
      totalPrev,
      deltaGlobal,
    };
  }, [weekWorkoutsFlat, prevWeekWorkouts]);

  /* ---------------- render ---------------- */

  const todayLabel = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return formatFRShort(d);
  }, []);

  const tomorrowLabel = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    return formatFRShort(d);
  }, []);

  return (
    <main className="min-h-screen px-6 py-10 text-white">
      {/* background dark + glow */}
      <div className="fixed inset-0 -z-10 bg-[#070A12]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(900px_500px_at_15%_10%,rgba(120,119,198,0.22),transparent_60%),radial-gradient(900px_500px_at_85%_10%,rgba(56,189,248,0.16),transparent_60%),radial-gradient(900px_500px_at_50%_85%,rgba(34,197,94,0.10),transparent_60%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_35%,rgba(0,0,0,0.35))]" />

      <div className="mb-6">
        <HeaderBar onLogout={handleLogout} />
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        {/* TODAY / TOMORROW */}
        <section className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between px-1">
            <div className="text-sm font-semibold text-white/85">
              Mes séances
            </div>

            <div className="text-xs text-white/50">
              Aujourd’hui + demain
            </div>
          </div>

          {/* Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* today */}
            <div className="rounded-[24px] border border-white/8 shadow-[0_20px_80px_rgba(0,0,0,0.45)] bg-white/[0.04] backdrop-blur p-4 space-y-4">
              <div className="flex items-baseline justify-between">
                <div className="text-[12px] font-semibold text-white/90">
                  Aujourd’hui
                </div>
                <div className="text-[11px] text-white/55">
                  {todayLabel}
                </div>
              </div>

              <div className="space-y-4">
                {todayWorkouts.length === 0 ? (
                  <div className="text-[12px] text-white/45">
                    Rien de prévu.
                  </div>
                ) : (
                  todayWorkouts.map((w) => (
                    <DetailedWorkoutCard
                      key={w.id}
                      workout={w}
                      onOpen={() => openDetail(w)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* tomorrow */}
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] backdrop-blur p-4 space-y-4">
              <div className="flex items-baseline justify-between">
                <div className="text-[12px] font-semibold text-white/90">
                  Demain
                </div>
                <div className="text-[11px] text-white/55">
                  {tomorrowLabel}
                </div>
              </div>

              <div className="space-y-4">
                {tomorrowWorkouts.length === 0 ? (
                  <div className="text-[12px] text-white/45">
                    Rien de prévu.
                  </div>
                ) : (
                  tomorrowWorkouts.map((w) => (
                    <DetailedWorkoutCard
                      key={w.id}
                      workout={w}
                      onOpen={() => openDetail(w)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* WEEK NAV */}
        <section className="flex items-center justify-center gap-4">
          <button
            className="w-10 h-10 rounded-full border border-white/10 bg-white/5 backdrop-blur flex items-center justify-center hover:bg-white/10 active:scale-[0.98] transition"
            onClick={() => {
              const prev = new Date(weekStart);
              prev.setDate(prev.getDate() - 7);
              setWeekStart(startOfWeekMonday(prev));
            }}
            aria-label="Semaine précédente"
            type="button"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="px-5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur">
            <div className="font-medium text-sm sm:text-base text-white/90">
              Semaine {getISOWeekNumber(weekStart)} <span className="text-white/50">•</span>{" "}
              <span className="text-white/75">
                {formatFRShort(weekDays[0])} → {formatFRShort(weekDays[6])}
              </span>
            </div>
          </div>

          <button
            className="w-10 h-10 rounded-full border border-white/10 bg-white/5 backdrop-blur flex items-center justify-center hover:bg-white/10 active:scale-[0.98] transition"
            onClick={() => {
              const next = new Date(weekStart);
              next.setDate(next.getDate() + 7);
              setWeekStart(startOfWeekMonday(next));
            }}
            aria-label="Semaine suivante"
            type="button"
          >
            <ChevronRight size={20} />
          </button>
        </section>

        {/* WEEK PLANNER */}
        <section>
          <WeekPlanner
            weekDays={weekDays}
            workoutsByDate={workoutsByDate}
            restDay={restDay}
            dayKeyToDow={dayKeyToDow}
            onAdd={openAddModal}
            onOpenDetail={openDetail}
            onMoveWorkout={handleMoveWorkout}
          />
        </section>

        {/* STATS (simple MVP) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Donut
            label="Séances réalisées"
            value={stats.doneCount}
            total={stats.plannedCount}
            footerLeft={`Prévu : ${stats.plannedCount}`}
            footerRight={`Fait : ${stats.doneCount}`}
          />

          <Donut
            label="Temps réalisé"
            value={stats.doneMinutes}
            total={stats.plannedMinutes}
            footerLeft={`Prévu : ${minsToPretty(stats.plannedMinutes)}`}
            footerRight={`Réel : ${minsToPretty(stats.doneMinutes)} (sans fallback)`}
          />

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-semibold text-white/85">Charge prévue</div>
              <div className="text-[12px] font-semibold text-white/80">
                {formatPct(stats.deltaGlobal)}
              </div>
            </div>

            <div className="mt-1 text-[11px] text-white/45">
              vs semaine dernière (minutes prévues)
            </div>

            <div className="mt-4 space-y-3">
              {stats.activities.length === 0 ? (
                <div className="text-[12px] text-white/45">Aucune donnée.</div>
              ) : (
                stats.activities.map((a) => {
                  const p = a.prev || 0;
                  const d = a.planned || 0;
                  const delta = pctDelta(d, p);

                  const width = stats.totalThis > 0 ? (d / stats.totalThis) * 100 : 0;

                  return (
                    <div key={a.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-3 w-3 rounded-md border border-white/15"
                            style={{ backgroundColor: hexToRgba(a.color, 0.65) }}
                            aria-hidden="true"
                          />
                          <div className="text-[12px] font-semibold text-white/85 truncate">
                            {a.name}
                          </div>
                        </div>

                        <div className="shrink-0 text-[11px] text-white/70">
                          {minsToPretty(d)}{" "}
                          <span className="text-white/35">•</span>{" "}
                          <span className="font-semibold text-white/75">{formatPct(delta)}</span>
                        </div>
                      </div>

                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${clamp(width, 0, 100)}%`, backgroundColor: "rgba(255,255,255,0.55)" }}
                        />
                      </div>

                      <div className="text-[11px] text-white/45">
                        S-1 : {minsToPretty(p)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>

      {/* MODAL ADD/EDIT */}
      <Modal
        open={addOpen}
        title={
          editingWorkoutId
            ? `Modifier la séance — ${selectedDate ?? ""}`
            : selectedDate
            ? `Ajouter une séance — ${selectedDate}`
            : "Ajouter une séance"
        }
        onClose={() => {
          setAddOpen(false);
          resetForm();
        }}
      >
        <div className="space-y-3">
          <label className="block">
            <div className="text-sm font-medium mb-1">Activité (obligatoire)</div>

            {!createActivity ? (
              <select
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                value={activityId}
                onChange={(e) => setActivityId(e.target.value)}
              >
                <option value="">— choisir —</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id} className="text-black">
                    {a.name} ({a.distance_unit})
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                  placeholder="Nom (ex: Yoga)"
                  value={newActName}
                  onChange={(e) => setNewActName(e.target.value)}
                />
                <input
                  type="color"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 h-[42px]"
                  value={newActColor}
                  onChange={(e) => setNewActColor(e.target.value)}
                  title="Couleur"
                />
                <select
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                  value={newActUnit}
                  onChange={(e) => setNewActUnit(e.target.value)}
                >
                  <option value="km" className="text-black">km</option>
                  <option value="m" className="text-black">m</option>
                </select>
              </div>
            )}

            <label className="flex items-center gap-2 mt-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={createActivity}
                onChange={(e) => {
                  setCreateActivity(e.target.checked);
                  setActivityId("");
                }}
                className="accent-white"
              />
              Créer une nouvelle activité
            </label>
          </label>

          <label className="block">
            <div className="text-sm font-medium mb-1">Titre (optionnel)</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
              placeholder="Sinon on génère automatiquement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm font-medium mb-1">Durée (hh:mm)</div>
              <input
                type="time"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                value={durationHHMM}
                onChange={(e) => setDurationHHMM(e.target.value)}
              />
            </label>

            <label className="block">
              <div className="text-sm font-medium mb-1">Distance (optionnel)</div>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                placeholder="km ou m selon activité"
                value={distanceInput}
                onChange={(e) => setDistanceInput(e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <div className="text-sm font-medium mb-1">Notes (optionnel)</div>
            <textarea
              className="w-full min-h-[90px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <details className="rounded-xl border border-white/10 bg-white/5 p-3">
            <summary className="cursor-pointer font-medium text-white/85">Données avancées</summary>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                placeholder="RPE (1-10)"
                value={advRpe}
                onChange={(e) => setAdvRpe(e.target.value)}
              />
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                placeholder="FC moyenne"
                value={advAvgHr}
                onChange={(e) => setAdvAvgHr(e.target.value)}
              />
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                placeholder="D+ (m)"
                value={advElevation}
                onChange={(e) => setAdvElevation(e.target.value)}
              />
            </div>
          </details>

          <div className="flex justify-end gap-2 pt-2">
            <button
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-white/80"
              onClick={() => {
                setAddOpen(false);
                resetForm();
              }}
              type="button"
            >
              Annuler
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 transition"
              onClick={() => {
                if (!createActivity && !activityId) {
                  alert("Choisis une activité (ou coche 'Créer une activité').");
                  return;
                }
                handleSaveWorkout();
              }}
              type="button"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL DONE */}
      <Modal
        open={doneOpen}
        title="Séance réalisée ✅"
        onClose={() => {
          setDoneOpen(false);
          setDoneWorkout(null);
        }}
      >
        <div className="space-y-3">
          <div className="text-sm text-white/60">
            Ajuste les stats réelles. (Le donut “temps” ne compte que le réel, sans fallback.)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm font-medium mb-1">Durée réelle (hh:mm)</div>
              <input
                type="time"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                value={actualDurationHHMM}
                onChange={(e) => setActualDurationHHMM(e.target.value)}
              />
            </label>

            <label className="block">
              <div className="text-sm font-medium mb-1">Distance réelle</div>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                value={actualDistanceInput}
                onChange={(e) => setActualDistanceInput(e.target.value)}
                placeholder={doneWorkout?.activity?.distance_unit === "m" ? "m" : "km"}
              />
            </label>
          </div>

          <label className="block">
            <div className="text-sm font-medium mb-1">Notes réelles (optionnel)</div>
            <textarea
              className="w-full min-h-[80px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
              value={actualNotes}
              onChange={(e) => setActualNotes(e.target.value)}
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-white/80"
              onClick={() => {
                setDoneOpen(false);
                setDoneWorkout(null);
              }}
              type="button"
            >
              Annuler
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 transition"
              onClick={confirmDone}
              type="button"
            >
              Valider ✅
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL DETAIL */}
      <Modal
        open={detailOpen}
        title="Détail de la séance"
        onClose={() => {
          setDetailOpen(false);
          setSelectedWorkout(null);
        }}
      >
        {selectedWorkout ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded"
                style={{ backgroundColor: selectedWorkout.activity?.color ?? "#999" }}
              />
              <p className="font-semibold">
                {selectedWorkout.title || selectedWorkout.activity?.name || "Séance"}
              </p>
            </div>

            <p className="text-sm text-white/55">{selectedWorkout.workout_date}</p>

            <div className="text-sm text-white/80 space-y-1">
              <p>Prévu : {minsToPretty(selectedWorkout.duration_min)} • {metersToPretty(selectedWorkout.activity, selectedWorkout.distance_m)}</p>

              {selectedWorkout.done ? (
                <p>
                  Réel : {minsToPretty(selectedWorkout.actual_duration_min)} • {metersToPretty(selectedWorkout.activity, selectedWorkout.actual_distance_m)}
                </p>
              ) : null}
            </div>

            {selectedWorkout.notes ? (
              <div className="border border-white/10 rounded-xl p-3 bg-white/5">
                <p className="font-medium mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap text-white/80">{selectedWorkout.notes}</p>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 pt-2">
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
                  onClick={() => {
                    const w = selectedWorkout;
                    setDetailOpen(false);
                    setSelectedWorkout(null);
                    openEditModal(w);
                  }}
                  type="button"
                >
                  Modifier
                </button>

                <button
                  className="px-4 py-2 rounded-xl bg-red-600 text-white"
                  onClick={() => handleDeleteWorkout(selectedWorkout.id)}
                  type="button"
                >
                  Supprimer
                </button>
              </div>

              <div className="flex gap-2">
                {selectedWorkout.done ? (
                  <button
                    className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
                    onClick={() => undoDone(selectedWorkout)}
                    type="button"
                    title="Retirer le statut fait"
                  >
                    Annuler “fait”
                  </button>
                ) : (
                  <button
                    className="px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 transition"
                    onClick={() => openDoneModalFromDetail(selectedWorkout)}
                    type="button"
                  >
                    Valider ✅
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}