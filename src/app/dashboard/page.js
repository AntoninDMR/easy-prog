"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import WeeklySummary from "@/components/WeeklySummary";
import HeaderBar from "@/components/HeaderBar";

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

/* ---------------- utils dates ---------------- */

function formatFRShort(date) {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
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
  const dayNum = d.getUTCDay() || 7; // lun=1..dim=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // jeudi de la semaine ISO
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

// ✅ Convertit un ISO yyyy-mm-dd en clé "mon".."sun"
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

function kmToMeters(km) {
  if (km == null || km === "") return null;
  const n = Number(km);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 1000);
}

function metersToKm(m) {
  if (m == null) return "";
  return (m / 1000).toString();
}

/* ---------------- Sortable item ---------------- */

function SortableWorkout({ workout, onClick, onToggleDone }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: workout.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const color = workout.activity?.color ?? "#999999";
  const bg = `${color}22`;
  const border = `${color}55`;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: bg,
        borderColor: border,
      }}
      className={[
        "relative rounded-xl px-2.5 py-2.5 text-sm select-none border border-white/10",
        "bg-white/5 backdrop-blur",
        "hover:bg-white/10 transition",
        isDragging ? "opacity-60" : "opacity-100",
      ].join(" ")}
    >
      {/* ✅ BULLE DONE (hors du bouton principal) */}
      <label
        className="absolute top-2 left-2 z-10"
        onClick={(e) => e.stopPropagation()} // empêche d'ouvrir le détail
      >
        <input
          type="checkbox"
          checked={!!workout.done}
          onChange={() => onToggleDone?.(workout)}
          className="
            h-5 w-5
            rounded-md
            border border-white/15
            bg-black/20
            backdrop-blur
            shadow-sm
            cursor-pointer
            accent-white
          "
          title={workout.done ? "Marquer comme non fait" : "Marquer comme fait"}
        />
      </label>

      {/* Zone cliquable = ouvre le détail */}
      <button
        type="button"
        onClick={() => onClick(workout)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-2 pl-6">
          <div className="font-medium leading-tight">
            {workout.title || workout.activity?.name || "Séance"}
          </div>
        </div>

        <div className="text-xs text-white/60 mt-1">          {workout.duration_min != null ? `${workout.duration_min} min` : ""}
          {workout.duration_min != null && workout.distance_m != null ? " • " : ""}
          {workout.distance_m != null
            ? workout.activity?.distance_unit === "m"
              ? `${workout.distance_m} m`
              : `${(workout.distance_m / 1000).toFixed(1)} km`
            : ""}
        </div>
      </button>

      {/* Poignée de drag */}
      <div className="mt-2 flex justify-center">
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="Glisser pour déplacer"
            className="cursor-grab active:cursor-grabbing px-3 py-2 rounded-lg hover:bg-white/10 transition"        >
          <div className="flex flex-col gap-[2px] items-center">
            <div className="w-10 h-[2px] bg-white/25 rounded-full" />
            <div className="w-10 h-[2px] bg-white/25 rounded-full" />
            <div className="w-10 h-[2px] bg-white/25 rounded-full" />
          </div>
        </button>
      </div>
    </div>
  );
}
/* ---------------- Mini Modal component ---------------- */

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

function DayColumn({ dayKey, className = "", children }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey });

  return (
    <div ref={setNodeRef} className={[className, isOver ? "ring-2 ring-black/40" : ""].join(" ")}>
      {children}
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState(null);

  const [doneOpen, setDoneOpen] = useState(false);
  const [doneWorkout, setDoneWorkout] = useState(null);

  const [actualDurationHHMM, setActualDurationHHMM] = useState("");
  const [actualDistanceInput, setActualDistanceInput] = useState("");
  const [actualNotes, setActualNotes] = useState("");

  const [editingWorkoutId, setEditingWorkoutId] = useState(null);

  const [activities, setActivities] = useState([]); // [{id,name,color,distance_unit}]
  const [workoutsByDate, setWorkoutsByDate] = useState({}); // { date: [workout...] }

  // ✅ jour de repos (profil)
  const [restDay, setRestDay] = useState(null); // "mon".."sun"

  // Modal states
  const [addOpen, setAddOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState(null); // yyyy-mm-dd
  const [selectedWorkout, setSelectedWorkout] = useState(null);

  // Form states
  const [activityId, setActivityId] = useState("");
  const [durationHHMM, setDurationHHMM] = useState("");
  const [distanceInput, setDistanceInput] = useState(""); // km ou m selon activité
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  // Advanced (jsonb)
  const [advRpe, setAdvRpe] = useState("");
  const [advAvgHr, setAdvAvgHr] = useState("");
  const [advElevation, setAdvElevation] = useState("");

  // Create activity in same modal
  const [createActivity, setCreateActivity] = useState(false);
  const [newActName, setNewActName] = useState("");
  const [newActColor, setNewActColor] = useState("#22c55e");
  const [newActUnit, setNewActUnit] = useState("km"); // km / m

  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const dayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  function resetForm() {
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

 async function handleToggleDone(workout) {
    if (!userId) return;

    // ✅ si on décoche → update direct
    if (workout.done) {
      const { error } = await supabase
        .from("workouts")
        .update({
          done: false,
          done_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workout.id);

      if (error) {
        alert("Erreur: " + error.message);
        return;
      }

      await loadAll(userId);
      return;
    }

    // ✅ si on coche → on ouvre la modale pour ajuster le réel (optionnel)
    setDoneWorkout(workout);
    setActualDurationHHMM(minutesToHHMM(workout.duration_min));
    setActualDistanceInput(metersToDisplay(workout.activity, workout.distance_m));
    setActualNotes("");

    setDoneOpen(true);
  }

  async function confirmDone() {
    if (!doneWorkout) return;

    const act = doneWorkout.activity;

    const actualDurationMin = hhmmToMinutes(actualDurationHHMM);
    const actualDistanceM = displayToMeters(act, actualDistanceInput);

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
      .eq("id", doneWorkout.id);

    if (error) {
      alert("Erreur validation: " + error.message);
      return;
    }

    setDoneOpen(false);
    setDoneWorkout(null);
    await loadAll(userId);
  }
  
  async function loadAll(uid) {
    // Activities
    const { data: acts, error: actErr } = await supabase
      .from("activities")
      .select("id, name, color, distance_unit")
      .order("name", { ascending: true });

    if (actErr) {
      alert("Erreur activités: " + actErr.message);
      return;
    }
    setActivities(acts ?? []);

    // Workouts (semaine)
    const from = toISODate(weekDays[0]);
    const to = toISODate(weekDays[6]);

    const { data: workouts, error: wErr } = await supabase
      .from("workouts")
      .select(
        "id, workout_date, position, activity_id, title, duration_min, distance_m, done, done_at, actual_duration_min, actual_distance_m, actual_notes, notes, advanced, activity:activities(id,name,color,distance_unit)"
      )
      .gte("workout_date", from)
      .lte("workout_date", to)
      .order("workout_date", { ascending: true })
      .order("position", { ascending: true });

    if (wErr) {
      alert("Erreur entrainements: " + wErr.message);
      return;
    }

    const map = {};
    for (const w of workouts ?? []) {
      const key = w.workout_date;
      map[key] = map[key] ? [...map[key], w] : [w];
    }
    setWorkoutsByDate(map);
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");

      // ✅ charger rest_day du profil
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("planning_prefs")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (pErr) {
        console.warn("Profil non chargé:", pErr.message);
      } else {
        setRestDay(prof?.planning_prefs?.rest_day ?? null);
      }

      await ensureDefaultActivities(data.user.id);
      await loadAll(data.user.id);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, weekStart]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
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
    if (workout.distance_m == null) {
      setDistanceInput("");
    } else if (unit === "m") {
      setDistanceInput(String(workout.distance_m));
    } else {
      setDistanceInput(String(workout.distance_m / 1000));
    }

    const adv = workout.advanced ?? {};
    setAdvRpe(adv.rpe != null ? String(adv.rpe) : "");
    setAdvAvgHr(adv.avg_hr != null ? String(adv.avg_hr) : "");
    setAdvElevation(adv.elevation_m != null ? String(adv.elevation_m) : "");

    setAddOpen(true);
  }

  function openAddModal(dateObj) {
    resetForm();
    setEditingWorkoutId(null);
    setSelectedDate(toISODate(dateObj));
    setAddOpen(true);
  }

  function openDetail(workout) {
    setSelectedWorkout(workout);
    setDetailOpen(true);
  }

  function autoTitle(act, durationMin, distanceM) {
    if (!act) return "Séance";
    const parts = [act.name];
    if (durationMin != null) parts.push(`${durationMin} min`);
    if (distanceM != null) {
      parts.push(
        act.distance_unit === "m"
          ? `${distanceM} m`
          : `${(distanceM / 1000).toFixed(1)} km`
      );
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
        distanceM = kmToMeters(distanceInput);
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
        .eq("id", editingWorkoutId);

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

    const { data, error } = await supabase
      .from("workouts")
      .insert({
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
      })
      .select(
        "id, workout_date, position, activity_id, title, duration_min, distance_m, notes, advanced, activity:activities(id,name,color,distance_unit)"
      )
      .single();

    if (error) {
      alert("Erreur création séance: " + error.message);
      return;
    }

    setWorkoutsByDate((prev) => {
      const next = { ...prev };
      next[selectedDate] = next[selectedDate] ? [...next[selectedDate], data] : [data];
      return next;
    });

    setAddOpen(false);
  }

  async function handleDeleteWorkout(id) {
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (error) {
      alert("Erreur suppression: " + error.message);
      return;
    }

    setWorkoutsByDate((prev) => {
      const next = {};
      for (const [dayKey, items] of Object.entries(prev)) {
        const filtered = items.filter((w) => w.id !== id);
        next[dayKey] = filtered.map((w, idx) => ({ ...w, position: idx }));
      }
      return next;
    });

    setDetailOpen(false);
    setSelectedWorkout(null);
  }

  function findDayKeyByWorkoutId(id) {
    for (const [dayKey, items] of Object.entries(workoutsByDate)) {
      if (items.some((w) => w.id === id)) return dayKey;
    }
    return null;
  }

  async function onDragEnd(event) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const fromDayKey = findDayKeyByWorkoutId(activeId);
    const toDayKey = findDayKeyByWorkoutId(overId) || overId;

    if (!fromDayKey || !toDayKey) return;

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
    );

    for (const w of reindexedFrom) {
      updates.push(
        supabase.from("workouts").update({ position: w.position, updated_at: new Date().toISOString() }).eq("id", w.id)
      );
    }

    for (const w of reindexedTo) {
      if (w.id === activeId) continue;
      updates.push(
        supabase.from("workouts").update({ position: w.position, updated_at: new Date().toISOString() }).eq("id", w.id)
      );
    }

    const results = await Promise.all(updates);
    const anyError = results.find((r) => r.error)?.error;
    if (anyError) alert("Erreur sauvegarde drag: " + anyError.message);
  }
  function metersToDisplay(activity, meters) {
    if (meters == null) return "";
    return activity?.distance_unit === "m" ? String(meters) : String(meters / 1000);
  }

  function displayToMeters(activity, val) {
    if (val === "" || val == null) return null;
    const n = Number(val);
    if (Number.isNaN(n)) return null;
    return activity?.distance_unit === "m" ? Math.round(n) : Math.round(n * 1000);
  }
  return (
    <main className="min-h-screen px-6 py-10 text-white">
      {/* background dark + glow */}
      <div className="fixed inset-0 -z-10 bg-[#070A12]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(900px_500px_at_15%_10%,rgba(120,119,198,0.22),transparent_60%),radial-gradient(900px_500px_at_85%_10%,rgba(56,189,248,0.16),transparent_60%),radial-gradient(900px_500px_at_50%_85%,rgba(34,197,94,0.10),transparent_60%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_35%,rgba(0,0,0,0.35))]" />

      {/* header */}
      <div className="mb-6">
        <HeaderBar onLogout={handleLogout} />
      </div>

      {/* contenu */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Ma semaine</h1>
            <p className="text-white/55 mt-1">{email ? `User : ${email}` : "User"}</p>
            <p className="text-white/70 mt-4 font-medium">Voici votre semaine d’entrainement.</p>
          </div>
        </div>

        {/* Navigation semaine */}
        <div className="mt-6 flex items-center justify-center gap-4">
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
              Semaine {getISOWeekNumber(weekStart)}{" "}
              <span className="text-white/50">•</span>{" "}
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
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-7 gap-3">
            {weekDays.map((d, i) => {
              const dayKey = toISODate(d);
              const items = workoutsByDate[dayKey] ?? [];
              const dayNum = d.getDate();

              const dow = dayKeyToDow(dayKey);
              const isRest = restDay && dow === restDay;

              return (
                <DayColumn
                  key={dayKey}
                  dayKey={dayKey}
                  className={[
                    "group rounded-2xl p-3 min-h-[220px] transition flex flex-col",
                    "border border-white/10 bg-white/[0.06] backdrop-blur",
                    "hover:bg-white/[0.10] hover:border-white/15",
                    "shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
                  ].join(" ")}
                >
                  <div className="font-semibold flex items-center justify-between">
                    <div>
                      {dayLabels[i]}{" "}
                      <span className="text-white/50 group-hover:text-white/80">({dayNum})</span>
                    </div>

                    {isRest ? (
                      <span
                        className="
                          text-xs font-semibold
                          px-2.5 py-1 rounded-full
                          border border-white/12
                          bg-white/5 backdrop-blur
                          text-white/80
                          flex items-center gap-1
                          shadow-sm
                          opacity-90
                          transition
                          group-hover:opacity-100
                        "
                        title="Jour de repos"
                      >
                        <span className="leading-none">🌙</span>
                        <span>Repos</span>
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-2">
                    <SortableContext items={items.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                      {items.length === 0 ? (
                        <p className="text-sm text-white/45 group-hover:text-white/70">Aucun entrainement</p>
                      ) : (
                        items.map((w) => (
                          <SortableWorkout
                            key={w.id}
                            workout={w}
                            onClick={openDetail}
                            onToggleDone={handleToggleDone}
                          />
                        ))
                      )}
                    </SortableContext>
                  </div>

                  {/* + Ajouter en bas centré (hover) */}
                  <div className="mt-auto pt-3 flex justify-center">
                    <button
                      onClick={() => openAddModal(d)}
                      className="opacity-0 group-hover:opacity-100 transition px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white/80 flex items-center gap-2"
                    >
                      <span className="text-lg leading-none">＋</span>
                      <span>Ajouter un entrainement</span>
                    </button>
                  </div>
                </DayColumn>
              );
            })}
          </div>
        </DndContext>

        <WeeklySummary
          workoutsByDate={workoutsByDate}
          activities={activities}
          weekDays={weekDays}
          goals={{ minutes: 360, workouts: 5 }}
        />
      </div>

      {/* MODAL ADD */}
      <Modal
        open={addOpen}
        title={selectedDate ? `Ajouter une séance — ${selectedDate}` : "Ajouter une séance"}
        onClose={() => setAddOpen(false)}
      >
        <div className="space-y-3">
          <label className="block">
            <div className="text-sm font-medium mb-1">Activité (obligatoire)</div>

            {!createActivity ? (
              <select
                className="border rounded px-3 py-2 w-full"
                value={activityId}
                onChange={(e) => setActivityId(e.target.value)}
              >
                <option value="">— choisir —</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.distance_unit})
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  className="border rounded px-3 py-2"
                  placeholder="Nom (ex: Yoga)"
                  value={newActName}
                  onChange={(e) => setNewActName(e.target.value)}
                />
                <input
                  type="color"
                  className="border rounded px-3 py-2 h-[42px]"
                  value={newActColor}
                  onChange={(e) => setNewActColor(e.target.value)}
                  title="Couleur"
                />
                <select
                  className="border rounded px-3 py-2"
                  value={newActUnit}
                  onChange={(e) => setNewActUnit(e.target.value)}
                >
                  <option value="km">km</option>
                  <option value="m">m</option>
                </select>
              </div>
            )}

            <label className="flex items-center gap-2 mt-2 text-sm">
              <input
                type="checkbox"
                checked={createActivity}
                onChange={(e) => {
                  setCreateActivity(e.target.checked);
                  setActivityId("");
                }}
              />
              Créer une nouvelle activité (avec couleur)
            </label>
          </label>

          {!createActivity && (
            <p className="text-xs text-gray-600">
              Astuce : plus tard on fera un écran “Gérer mes activités” (Yoga rose, etc.).
            </p>
          )}

          <label className="block">
            <div className="text-sm font-medium mb-1">Titre (optionnel)</div>
            <input
              className="border rounded px-3 py-2 w-full"
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
                className="border rounded px-3 py-2 w-full"
                value={durationHHMM}
                onChange={(e) => setDurationHHMM(e.target.value)}
              />
              <p className="text-xs text-gray-600 mt-1">Stocké en minutes.</p>
            </label>

            <label className="block">
              <div className="text-sm font-medium mb-1">Distance (optionnel)</div>
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="km ou m selon activité"
                value={distanceInput}
                onChange={(e) => setDistanceInput(e.target.value)}
              />
              <p className="text-xs text-gray-600 mt-1">Stocké en mètres.</p>
            </label>
          </div>

          <label className="block">
            <div className="text-sm font-medium mb-1">Détails / notes (optionnel)</div>
            <textarea
              className="border rounded px-3 py-2 w-full min-h-[90px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: 10' échauffement, 6x400m, retour au calme..."
            />
          </label>

          <details className="border rounded p-3">
            <summary className="cursor-pointer font-medium">Données avancées</summary>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                className="border rounded px-3 py-2"
                placeholder="RPE (1-10)"
                value={advRpe}
                onChange={(e) => setAdvRpe(e.target.value)}
              />
              <input
                className="border rounded px-3 py-2"
                placeholder="FC moyenne"
                value={advAvgHr}
                onChange={(e) => setAdvAvgHr(e.target.value)}
              />
              <input
                className="border rounded px-3 py-2"
                placeholder="D+ (m)"
                value={advElevation}
                onChange={(e) => setAdvElevation(e.target.value)}
              />
            </div>
          </details>

          <div className="flex justify-end gap-2 pt-2">
            <button className="px-4 py-2 border rounded" onClick={() => setAddOpen(false)}>
              Annuler
            </button>
            <button
              className="px-4 py-2 bg-black text-white rounded"
              onClick={() => {
                if (!createActivity && !activityId) {
                  alert("Choisis une activité (ou coche 'Créer une activité').");
                  return;
                }
                handleSaveWorkout();
              }}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={doneOpen}
        title="Séance réalisée ✅"
        onClose={() => {
          setDoneOpen(false);
          setDoneWorkout(null);
        }}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Tu peux ajuster les stats réelles (optionnel). Sinon, on garde les valeurs prévues.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm font-medium mb-1">Durée réelle (hh:mm)</div>
              <input
                type="time"
                className="border rounded px-3 py-2 w-full"
                value={actualDurationHHMM}
                onChange={(e) => setActualDurationHHMM(e.target.value)}
              />
            </label>

            <label className="block">
              <div className="text-sm font-medium mb-1">Distance réelle</div>
              <input
                className="border rounded px-3 py-2 w-full"
                value={actualDistanceInput}
                onChange={(e) => setActualDistanceInput(e.target.value)}
                placeholder={doneWorkout?.activity?.distance_unit === "m" ? "m" : "km"}
              />
            </label>
          </div>

          <label className="block">
            <div className="text-sm font-medium mb-1">Notes réelles (optionnel)</div>
            <textarea
              className="border rounded px-3 py-2 w-full min-h-[80px]"
              value={actualNotes}
              onChange={(e) => setActualNotes(e.target.value)}
              placeholder="Ex: séance plus dure, météo, sensations..."
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              className="px-4 py-2 border rounded"
              onClick={() => {
                setDoneOpen(false);
                setDoneWorkout(null);
              }}
            >
              Annuler
            </button>
            <button className="px-4 py-2 bg-black text-white rounded" onClick={confirmDone}>
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
              <p className="font-semibold">{selectedWorkout.title || selectedWorkout.activity?.name}</p>
            </div>

            <p className="text-sm text-gray-600">{selectedWorkout.workout_date}</p>

            <div className="text-sm">
              {selectedWorkout.duration_min != null ? (
                <p>
                  Durée : {minutesToHHMM(selectedWorkout.duration_min)} (≈ {selectedWorkout.duration_min} min)
                </p>
              ) : (
                <p>Durée : —</p>
              )}
              {selectedWorkout.distance_m != null ? (
                <p>
                  Distance :{" "}
                  {selectedWorkout.activity?.distance_unit === "m"
                    ? `${selectedWorkout.distance_m} m`
                    : `${metersToKm(selectedWorkout.distance_m)} km`}
                </p>
              ) : (
                <p>Distance : —</p>
              )}
            </div>

            {selectedWorkout.notes ? (
              <div className="border rounded p-3">
                <p className="font-medium mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{selectedWorkout.notes}</p>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 border rounded"
                onClick={() => {
                  const w = selectedWorkout;
                  setDetailOpen(false);
                  setSelectedWorkout(null);
                  openEditModal(w);
                }}
              >
                Modifier
              </button>

              <button
                className="px-4 py-2 bg-red-600 text-white rounded"
                onClick={() => handleDeleteWorkout(selectedWorkout.id)}
              >
                Supprimer
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}