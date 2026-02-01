"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import HeaderBar from "@/components/HeaderBar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import WeekPlanner from "@/components/WeekPlanner";

/* ---------------- utils dates ---------------- */

function dayKeyToDow(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[d.getDay()];
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
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/* ---------------- UI primitives ---------------- */

function IconButton({ children, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={[
        "w-10 h-10 rounded-full",
        "border border-white/10 bg-white/5 backdrop-blur",
        "text-white/80 hover:text-white",
        "hover:bg-white/10 transition",
        "shadow-[0_8px_22px_rgba(0,0,0,0.35)]",
        "flex items-center justify-center",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ---------------- Modal ---------------- */

function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-lg">
        <div className="rounded-2xl border border-white/10 bg-[#0B1020]/80 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-white/90">{title}</h2>
            <button
              type="button"
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white transition"
              onClick={onClose}
            >
              Fermer
            </button>
          </div>

          {children}
        </div>
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

  // activités + séances
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
  const { gridStart, gridEnd, weeks } = useMemo(() => {
    const first = new Date(monthCursor);
    first.setDate(1);
    first.setHours(0, 0, 0, 0);

    const last = new Date(monthCursor);
    last.setMonth(last.getMonth() + 1);
    last.setDate(0);
    last.setHours(0, 0, 0, 0);

    const start = startOfWeekMonday(first);

    const end = new Date(last);
    while (end.getDay() !== 0) end.setDate(end.getDate() + 1);
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

    return { gridStart: start, gridEnd: end, weeks: wk };
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
      .eq("user_id", uid)
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
    d.setHours(0, 0, 0, 0);
    setMonthCursor(d);
  }

  function nextMonth() {
    const d = new Date(monthCursor);
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    setMonthCursor(d);
  }

  const monthTitle = monthLabelFR(monthCursor);

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

      <div className="max-w-6xl mx-auto">
        {/* title */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white/90">Planifier</h1>
            <p className="text-sm text-white/50 mt-1">{email ? `User : ${email}` : "User"}</p>
            <p className="text-white/65 mt-4 font-medium">Planifie tes séances sur le mois.</p>
          </div>
        </div>

        {/* Navigation mois */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <IconButton onClick={prevMonth} title="Mois précédent">
            <ChevronLeft size={18} />
          </IconButton>

          <div className="text-center">
            <div className="font-semibold text-lg capitalize text-white/90">{monthTitle}</div>
            <div className="text-xs text-white/45">
              {toISODate(gridStart)} → {toISODate(gridEnd)}
            </div>
          </div>

          <IconButton onClick={nextMonth} title="Mois suivant">
            <ChevronRight size={18} />
          </IconButton>
        </div>

        {/* Semaines empilées */}
        <div className="mt-10 space-y-10">
          {weeks.map((week, wi) => {
            const weekStart = week[0];
            const weekEnd = week[6];
            const weekNo = getISOWeekNumber(weekStart);

            const weekDayKeys = week.map((d) => toISODate(d)); // pour limiter les moves à la semaine

            return (
              <section key={`${toISODate(weekStart)}-${wi}`} className="space-y-3">
                <div className="flex items-center justify-center font-semibold text-white/80">
                  Semaine {weekNo} — {formatFRShort(weekStart)} au {formatFRShort(weekEnd)}
                </div>

                <WeekPlanner
                  weekDays={week}
                  workoutsByDate={workoutsByDate}
                  dayLabels={dayLabels}
                  restDay={null}
                  dayKeyToDow={dayKeyToDow}
                  onAdd={openAddModal}
                  onOpenDetail={() => {}}
                  onMoveWorkout={async ({ activeId, overId, fromDayKey, toDayKey }) => {
                    // ✅ Simplifié: on refuse les déplacements hors de la semaine affichée
                    if (!weekDayKeys.includes(fromDayKey) || !weekDayKeys.includes(toDayKey)) return;

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

                    // optimistic UI
                    setWorkoutsByDate((prev) => ({
                      ...prev,
                      [fromDayKey]: reindexedFrom,
                      [toDayKey]: reindexedTo,
                    }));

                    // persist DB (uniquement les 2 jours)
                    const updates = [];

                    const newPos = reindexedTo.findIndex((w) => w.id === activeId);
                    updates.push(
                      supabase
                        .from("workouts")
                        .update({
                          workout_date: toDayKey,
                          position: newPos,
                          updated_at: new Date().toISOString(),
                        })
                        .eq("id", activeId)
                    );

                    for (const w of reindexedFrom) {
                      updates.push(
                        supabase
                          .from("workouts")
                          .update({
                            position: w.position,
                            updated_at: new Date().toISOString(),
                          })
                          .eq("id", w.id)
                      );
                    }

                    for (const w of reindexedTo) {
                      if (w.id === activeId) continue;
                      updates.push(
                        supabase
                          .from("workouts")
                          .update({
                            position: w.position,
                            updated_at: new Date().toISOString(),
                          })
                          .eq("id", w.id)
                      );
                    }

                    const results = await Promise.all(updates);
                    const anyError = results.find((r) => r.error)?.error;
                    if (anyError) {
                      alert("Erreur sauvegarde: " + anyError.message);
                      // rollback simple: reload month
                      await loadMonthWorkouts(userId);
                    }
                  }}
                />
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
          {/* Activité */}
          <label className="block">
            <div className="text-sm font-medium mb-1 text-white/85">Activité (obligatoire)</div>

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
                  <option value="km" className="text-black">
                    km
                  </option>
                  <option value="m" className="text-black">
                    m
                  </option>
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

          {/* Titre */}
          <label className="block">
            <div className="text-sm font-medium mb-1 text-white/85">Titre (optionnel)</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
              placeholder="Sinon on génère automatiquement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm font-medium mb-1 text-white/85">Durée (hh:mm)</div>
              <input
                type="time"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                value={durationHHMM}
                onChange={(e) => setDurationHHMM(e.target.value)}
              />
              <p className="text-xs text-white/45 mt-1">Stocké en minutes.</p>
            </label>

            <label className="block">
              <div className="text-sm font-medium mb-1 text-white/85">Distance (optionnel)</div>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                placeholder="km ou m selon activité"
                value={distanceInput}
                onChange={(e) => setDistanceInput(e.target.value)}
              />
              <p className="text-xs text-white/45 mt-1">Stocké en mètres.</p>
            </label>
          </div>

          {/* Notes */}
          <label className="block">
            <div className="text-sm font-medium mb-1 text-white/85">Notes (optionnel)</div>
            <textarea
              className="w-full min-h-[90px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white transition"
              onClick={() => setAddOpen(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 transition"
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