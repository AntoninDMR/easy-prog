"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ---------------- utils dates ---------------- */

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

function SortableWorkout({ workout, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workout.id });

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
        "rounded px-2 py-2 text-sm select-none border",
        "hover:brightness-95 transition",
        isDragging ? "opacity-60" : "opacity-100",
      ].join(" ")}
    >
      {/* Zone cliquable = ouvre le détail */}
      <button
        type="button"
        onClick={() => onClick(workout)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">
            {workout.title || workout.activity?.name || "Séance"}
          </div>
        </div>

        <div className="text-xs text-gray-700 mt-1">
          {workout.duration_min != null ? `${workout.duration_min} min` : ""}
          {workout.duration_min != null && workout.distance_m != null ? " • " : ""}
          {workout.distance_m != null
            ? workout.activity?.distance_unit === "m"
              ? `${workout.distance_m} m`
              : `${(workout.distance_m / 1000).toFixed(1)} km`
            : ""}
        </div>
      </button>

      {/* Poignée de drag (barre) */}
      <div className="mt-2 flex justify-center">
        <div
          {...attributes}
          {...listeners}
          title="Glisser pour déplacer"
          className="w-10 h-[2px] bg-gray-400 rounded-full cursor-grab hover:bg-gray-600 transition"
        />
      </div>
    </div>
  );
}

/* ---------------- Mini Modal component ---------------- */

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="px-3 py-2 border rounded" onClick={onClose}>
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function DashboardPage() {
  
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState(null);

  const [editingWorkoutId, setEditingWorkoutId] = useState(null);

  const [activities, setActivities] = useState([]); // [{id,name,color,distance_unit}]
  const [workoutsByDate, setWorkoutsByDate] = useState({}); // { date: [workout...] }

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

  const weekStart = useMemo(() => startOfWeekMonday(new Date()), []);
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const sensors = useSensors(useSensor(PointerSensor));
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
    // Si aucun, on crée Course/Vélo/Natation (par utilisateur)
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
        "id, workout_date, position, activity_id, title, duration_min, distance_m, notes, advanced, activity:activities(id,name,color,distance_unit)"
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

      await ensureDefaultActivities(data.user.id);
      await loadAll(data.user.id);
    }

    init();
  }, [router, weekDays]);

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
  setEditingWorkoutId(null); // 👈 important
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

    // upsert par (user_id, name)
    const { data, error } = await supabase
      .from("activities")
      .upsert(
        [{ user_id: uid, name, color: newActColor, distance_unit: newActUnit }],
        { onConflict: "user_id,name" }
      )
      .select("id, name, color, distance_unit")
      .single();

    if (error) {
      alert("Erreur création activité: " + error.message);
      return null;
    }

    // refresh activités
    setActivities((prev) => {
      const exists = prev.some((a) => a.id === data.id);
      const next = exists ? prev : [...prev, data];
      return next.sort((x, y) => x.name.localeCompare(y.name));
    });

    return data.id;
  }

  async function handleSaveWorkout() {
    console.log("SAVE CLICK", { editingWorkoutId, selectedDate, activityId, createActivity });
  if (!userId || !selectedDate) return;
  

  // ✅ On calcule actId AVANT tout
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

  const finalTitle = title.trim()
    ? title.trim()
    : autoTitle(act, durationMin, distanceM);

  const advanced = {
    ...(advRpe ? { rpe: Number(advRpe) } : {}),
    ...(advAvgHr ? { avg_hr: Number(advAvgHr) } : {}),
    ...(advElevation ? { elevation_m: Number(advElevation) } : {}),
  };

  // ================== MODE ÉDITION ==================
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

    // remove locally
    setWorkoutsByDate((prev) => {
      const next = {};
      for (const [dayKey, items] of Object.entries(prev)) {
        const filtered = items.filter((w) => w.id !== id);
        // reindex positions for that day
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
    if (active.id === over.id) return;

    const fromDayKey = findDayKeyByWorkoutId(active.id);
    const toDayKey = findDayKeyByWorkoutId(over.id);

    // même jour seulement
    if (!fromDayKey || !toDayKey || fromDayKey !== toDayKey) return;

    const items = workoutsByDate[fromDayKey] ?? [];
    const oldIndex = items.findIndex((w) => w.id === active.id);
    const newIndex = items.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex).map((w, idx) => ({
      ...w,
      position: idx,
    }));

    setWorkoutsByDate((prev) => ({ ...prev, [fromDayKey]: reordered }));

    const updates = reordered.map((w) =>
      supabase.from("workouts").update({ position: w.position }).eq("id", w.id)
    );

    const results = await Promise.all(updates);
    const anyError = results.find((r) => r.error)?.error;
    if (anyError) alert("Erreur sauvegarde ordre: " + anyError.message);
  }

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600 mt-1">{email ? `User : ${email}` : "User"}</p>
            <p className="text-gray-700 mt-4 font-medium">Voici votre semaine d’entrainement.</p>
          </div>

          <button onClick={handleLogout} className="px-4 py-2 bg-black text-white rounded">
            Se déconnecter
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-7 gap-3">
            {weekDays.map((d, i) => {
              const dayKey = toISODate(d);
              const items = workoutsByDate[dayKey] ?? [];
              const dayNum = d.getDate();

              return (
                <div
                  key={dayKey}
                  className="group bg-gray-200 hover:bg-gray-500 rounded p-3 min-h-[220px] transition flex flex-col"
                >
                  <div className="font-semibold">
                    {dayLabels[i]}{" "}
                    <span className="text-gray-600 group-hover:text-gray-100">({dayNum})</span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <SortableContext items={items.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                      {items.length === 0 ? (
                        <p className="text-sm text-gray-600 group-hover:text-gray-100">Aucun entrainement</p>
                      ) : (
                        items.map((w) => (
                          <SortableWorkout key={w.id} workout={w} onClick={openDetail} />
                        ))
                      )}
                    </SortableContext>
                  </div>

                  {/* + Ajouter en bas centré (hover) */}
                  <div className="mt-auto pt-3 flex justify-center">
                    <button
                      onClick={() => openAddModal(d)}
                      className="opacity-0 group-hover:opacity-100 transition px-3 py-2 rounded bg-white/60 hover:bg-white/80 text-sm flex items-center gap-2"
                    >
                      <span className="text-lg leading-none">＋</span>
                      <span>Ajouter un entrainement</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </DndContext>
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
                {selectedWorkout.title || selectedWorkout.activity?.name}
              </p>
            </div>

            <p className="text-sm text-gray-600">{selectedWorkout.workout_date}</p>

            <div className="text-sm">
              {selectedWorkout.duration_min != null ? (
                <p>Durée : {minutesToHHMM(selectedWorkout.duration_min)} (≈ {selectedWorkout.duration_min} min)</p>
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
              {/* édition : on la fera juste après (prochaine étape) */}
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