"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import HeaderBar from "@/components/HeaderBar";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

function kmToMeters(km) {
  if (km == null || km === "") return null;
  const n = Number(km);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 1000);
}

function monthLabelFR(date) {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function formatFRShort(date) {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // lun=1..dim=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // jeudi de la semaine ISO
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/* ---------------- Modal ---------------- */

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

export default function CalendarPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState(null);

  // mois affiché
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // activités + séances chargées sur la plage (début semaine -> fin semaine)
  const [activities, setActivities] = useState([]);
  const [workoutsByDate, setWorkoutsByDate] = useState({});

  // modal add
  const [addOpen, setAddOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  // form
  const [createActivity, setCreateActivity] = useState(false);
  const [activityId, setActivityId] = useState("");
  const [newActName, setNewActName] = useState("");
  const [newActColor, setNewActColor] = useState("#22c55e");
  const [newActUnit, setNewActUnit] = useState("km");

  const [title, setTitle] = useState("");
  const [durationHHMM, setDurationHHMM] = useState("");
  const [distanceInput, setDistanceInput] = useState("");
  const [notes, setNotes] = useState("");

  const dayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  function resetForm() {
    setCreateActivity(false);
    setActivityId("");
    setNewActName("");
    setNewActColor("#22c55e");
    setNewActUnit("km");
    setTitle("");
    setDurationHHMM("");
    setDistanceInput("");
    setNotes("");
  }

  // Construire la plage du mois en semaines complètes (Lun->Dim)
  const { gridStart, gridEnd, monthDays, weeks } = useMemo(() => {
    const first = new Date(monthCursor);
    first.setDate(1);
    first.setHours(0, 0, 0, 0);

    const last = new Date(monthCursor);
    last.setMonth(last.getMonth() + 1);
    last.setDate(0); // dernier jour du mois
    last.setHours(0, 0, 0, 0);

    const start = startOfWeekMonday(first);

    const end = new Date(last);
    while (end.getDay() !== 0) end.setDate(end.getDate() + 1); // jusqu'à dimanche
    end.setHours(0, 0, 0, 0);

    const days = [];
    const cur = new Date(start);
    while (cur <= end) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }

    const wk = [];
    for (let i = 0; i < days.length; i += 7) {
      wk.push(days.slice(i, i + 7));
    }

    return { gridStart: start, gridEnd: end, monthDays: days, weeks: wk };
  }, [monthCursor]);

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

  async function loadActivities(uid) {
    const { data, error } = await supabase
      .from("activities")
      .select("id, name, color, distance_unit")
      .eq("user_id", uid)
      .order("name", { ascending: true });

    if (error) {
      alert("Erreur activités: " + error.message);
      return;
    }
    setActivities(data ?? []);
  }

  async function loadMonthWorkouts(uid) {
    const from = toISODate(gridStart);
    const to = toISODate(gridEnd);

    const { data, error } = await supabase
      .from("workouts")
      .select(
        "id, workout_date, position, activity_id, title, duration_min, distance_m, notes, advanced, activity:activities(id,name,color,distance_unit)"
      )
      .gte("workout_date", from)
      .lte("workout_date", to)
      .order("workout_date", { ascending: true })
      .order("position", { ascending: true });

    if (error) {
      alert("Erreur séances: " + error.message);
      return;
    }

    const map = {};
    for (const w of data ?? []) {
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
      await loadActivities(data.user.id);
    }
    init();
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    loadMonthWorkouts(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, gridStart, gridEnd]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function openAddModal(dateObj) {
    resetForm();
    setSelectedDate(toISODate(dateObj));
    setAddOpen(true);
  }

  function autoTitle(act, durationMin, distanceM) {
    if (!act) return "Séance";
    const parts = [act.name];
    if (durationMin != null) parts.push(`${durationMin} min`);
    if (distanceM != null) {
      parts.push(
        act.distance_unit === "m" ? `${distanceM} m` : `${(distanceM / 1000).toFixed(1)} km`
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
        advanced: {},
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

  function prevMonth() {
    const d = new Date(monthCursor);
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    setMonthCursor(d);
  }

  function nextMonth() {
    const d = new Date(monthCursor);
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    setMonthCursor(d);
  }

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-8">
      <HeaderBar onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto mt-6">
        {/* Navigation mois */}
        <div className="flex items-center justify-center gap-4">
          <button
            className="p-2 rounded border bg-white hover:bg-gray-50"
            onClick={prevMonth}
            title="Mois précédent"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="font-bold text-lg capitalize">{monthLabelFR(monthCursor)}</div>

          <button
            className="p-2 rounded border bg-white hover:bg-gray-50"
            onClick={nextMonth}
            title="Mois suivant"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Semaines empilées */}
        <div className="mt-8 space-y-8">
          {weeks.map((week, wi) => {
            const weekStart = week[0];
            const weekEnd = week[6];
            const weekNo = getISOWeekNumber(weekStart);

            return (
              <section key={`${toISODate(weekStart)}-${wi}`} className="space-y-3">
                {/* En-tête semaine (comme dashboard) */}
                <div className="flex items-center justify-center font-bold text-lg">
                  Semaine {weekNo} — {formatFRShort(weekStart)} au {formatFRShort(weekEnd)}
                </div>

                {/* 7 colonnes */}
                <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
                  {week.map((d, i) => {
                    const dayKey = toISODate(d);
                    const items = workoutsByDate[dayKey] ?? [];
                    const inMonth = d.getMonth() === monthCursor.getMonth();
                    const dayNum = d.getDate();

                    return (
                      <div
                        key={dayKey}
                        className={[
                          "group rounded p-3 min-h-[220px] transition flex flex-col",
                          "bg-gray-200 hover:bg-gray-500",
                          inMonth ? "opacity-100" : "opacity-40",
                        ].join(" ")}
                      >
                        <div className="font-semibold">
                          {dayLabels[i]}{" "}
                          <span className="text-gray-600 group-hover:text-gray-100">
                            ({dayNum})
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          {items.length === 0 ? (
                            <p className="text-sm text-gray-600 group-hover:text-gray-100">
                              Aucun entrainement
                            </p>
                          ) : (
                            items.map((w) => {
                              const color = w.activity?.color ?? "#999999";
                              const bg = `${color}22`;
                              const border = `${color}55`;

                              return (
                                <div
                                  key={w.id}
                                  className="rounded px-2 py-2 text-sm select-none border hover:brightness-95 transition"
                                  style={{ backgroundColor: bg, borderColor: border }}
                                  title={w.title}
                                >
                                  <div className="font-medium">
                                    {w.title || w.activity?.name || "Séance"}
                                  </div>
                                  <div className="text-xs text-gray-700 mt-1">
                                    {w.duration_min != null ? `${w.duration_min} min` : ""}
                                    {w.duration_min != null && w.distance_m != null ? " • " : ""}
                                    {w.distance_m != null
                                      ? w.activity?.distance_unit === "m"
                                        ? `${w.distance_m} m`
                                        : `${(w.distance_m / 1000).toFixed(1)} km`
                                      : ""}
                                  </div>
                                </div>
                              );
                            })
                          )}
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
              </section>
            );
          })}
        </div>
      </div>

      {/* Modal Ajout */}
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
              Créer une nouvelle activité
            </label>
          </label>

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
            <div className="text-sm font-medium mb-1">Notes (optionnel)</div>
            <textarea
              className="border rounded px-3 py-2 w-full min-h-[90px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

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
    </main>
  );
}