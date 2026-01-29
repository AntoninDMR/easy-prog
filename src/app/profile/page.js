"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import HeaderBar from "@/components/HeaderBar";

const SPORT_OPTIONS = ["Course à pied", "Vélo", "Natation", "Renfo", "Yoga", "Stretching"];
const OBJECTIVE_OPTIONS = [
  { value: "competition", label: "Préparer une compétition" },
  { value: "forme", label: "Me maintenir en forme" },
];

const DAYS = [
  { key: "mon", label: "Lun" },
  { key: "tue", label: "Mar" },
  { key: "wed", label: "Mer" },
  { key: "thu", label: "Jeu" },
  { key: "fri", label: "Ven" },
  { key: "sat", label: "Sam" },
  { key: "sun", label: "Dim" },
];

function asInt(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function cx(...a) {
  return a.filter(Boolean).join(" ");
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

function Pill({ active, children, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cx(
        "px-3 py-2 rounded-full border text-sm transition",
        "border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20",
        active ? "bg-white/15 text-white border-white/20" : "text-white/75"
      )}
    >
      {children}
    </button>
  );
}

function Banner({ variant = "info", children }) {
  const styles =
    variant === "error"
      ? "border-red-400/20 bg-red-500/10 text-red-200"
      : variant === "success"
      ? "border-green-400/20 bg-green-500/10 text-green-200"
      : "border-white/10 bg-white/5 text-white/70";

  return (
    <div className={cx("mt-4 rounded-2xl border px-4 py-3 text-sm", styles)}>{children}</div>
  );
}

export default function ProfilePage() {
  const router = useRouter();

  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Profil
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [objective, setObjective] = useState("forme");
  const [sports, setSports] = useState([]);

  // Paramètres programmation (planning_prefs jsonb)
  const [availableDays, setAvailableDays] = useState(["mon", "wed", "fri"]);
  const [weeklyTargetHours, setWeeklyTargetHours] = useState("4");
  const [weeklyTargetKm, setWeeklyTargetKm] = useState("30");
  const [restDay, setRestDay] = useState("sun");

  // évite les doubles appels gênants en dev (Strict Mode)
  const didInitRef = useRef(false);

  const fullName = useMemo(() => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    return [fn, ln].filter(Boolean).join(" ") || "—";
  }, [firstName, lastName]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function toggleSport(s) {
    setSports((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function toggleDay(dayKey) {
    setAvailableDays((prev) =>
      prev.includes(dayKey) ? prev.filter((x) => x !== dayKey) : [...prev, dayKey]
    );
  }

  async function ensureProfileRow(uid) {
    const { data: exists, error: existsErr } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();

    if (existsErr) throw existsErr;

    if (!exists) {
      const { error: insErr } = await supabase.from("profiles").insert({
        user_id: uid,
        first_name: "",
        last_name: "",
        age: null,
        objective: "forme",
        sports: [],
        planning_prefs: {},
        updated_at: new Date().toISOString(),
      });
      if (insErr) throw insErr;
    }
  }

  async function loadProfile(uid) {
    setLoadError("");
    setSuccessMsg("");

    await ensureProfileRow(uid);

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, age, objective, sports, planning_prefs")
      .eq("user_id", uid)
      .single();

    if (error) throw error;

    setFirstName(data?.first_name ?? "");
    setLastName(data?.last_name ?? "");
    setAge(data?.age != null ? String(data.age) : "");
    setObjective(data?.objective ?? "forme");
    setSports(Array.isArray(data?.sports) ? data.sports : []);

    const prefs = data?.planning_prefs ?? {};
    setAvailableDays(Array.isArray(prefs.available_days) ? prefs.available_days : ["mon", "wed", "fri"]);
    setWeeklyTargetHours(prefs.weekly_target_hours != null ? String(prefs.weekly_target_hours) : "4");
    setWeeklyTargetKm(prefs.weekly_target_km != null ? String(prefs.weekly_target_km) : "30");
    setRestDay(prefs.rest_day ?? "sun");
  }

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    async function init() {
      setLoading(true);
      setLoadError("");
      setSaveError("");
      setSuccessMsg("");

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }

      setUserId(data.user.id);
      setEmail(data.user.email ?? "");

      try {
        await loadProfile(data.user.id);
      } catch (e) {
        setLoadError("Erreur chargement profil: " + (e?.message ?? String(e)));
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router]);

  async function handleSave() {
    if (!userId) return;

    setSaveError("");
    setSuccessMsg("");

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    const ageInt = asInt(age);
    if (ageInt != null && (ageInt < 5 || ageInt > 120)) {
      setSaveError("Âge invalide.");
      return;
    }

    if (!["competition", "forme"].includes(objective)) {
      setSaveError("Objectif invalide.");
      return;
    }

    const prefs = {
      available_days: availableDays,
      weekly_target_hours: Number(weeklyTargetHours || 0),
      weekly_target_km: Number(weeklyTargetKm || 0),
      rest_day: restDay,
    };

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          first_name: cleanFirst,
          last_name: cleanLast,
          age: ageInt,
          objective,
          sports,
          planning_prefs: prefs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    setSaving(false);

    if (error) {
      setSaveError("Erreur sauvegarde profil: " + error.message);
      return;
    }

    setSuccessMsg("Profil enregistré ✅");
  }

  return (
    <main className="min-h-screen px-6 py-10 text-white">
      {/* background dark + glow */}
      <div className="fixed inset-0 -z-10 bg-[#070A12]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(900px_500px_at_15%_10%,rgba(120,119,198,0.22),transparent_60%),radial-gradient(900px_500px_at_85%_10%,rgba(56,189,248,0.16),transparent_60%),radial-gradient(900px_500px_at_50%_85%,rgba(34,197,94,0.10),transparent_60%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_35%,rgba(0,0,0,0.35))]" />

      <div className="mb-6">
        <HeaderBar onLogout={handleLogout} />
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Mon profil</h1>
            <p className="text-white/55 mt-1">{email}</p>
            <p className="text-white/70 mt-4 font-medium">
              Ce profil sert aussi à mieux personnaliser ta programmation.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving || !userId}
            className={cx(
              "h-10 px-4 rounded-full border border-white/10 bg-white/10 hover:bg-white/15",
              "text-sm font-medium text-white transition disabled:opacity-50"
            )}
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>

        {loadError ? <Banner variant="error">{loadError}</Banner> : null}
        {saveError ? <Banner variant="error">{saveError}</Banner> : null}
        {successMsg ? <Banner variant="success">{successMsg}</Banner> : null}

        {loading ? (
          <GlassCard className="mt-8 p-6">
            <p className="text-white/60">Chargement…</p>
          </GlassCard>
        ) : (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Infos profil */}
            <GlassCard className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-white/60">Informations</div>
                  <div className="mt-1 text-lg font-semibold">Tes infos</div>
                </div>

                <div className="text-xs text-white/45">
                  Aperçu : <span className="text-white/80 font-medium">{fullName}</span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <div className="text-sm font-medium text-white/80 mb-1">Prénom</div>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-white/30 outline-none focus:border-white/25"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Antonin"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-white/80 mb-1">Nom</div>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-white/30 outline-none focus:border-white/25"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="de Muer"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-white/80 mb-1">Âge</div>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-white/30 outline-none focus:border-white/25"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="28"
                    inputMode="numeric"
                  />
                  <p className="text-xs text-white/40 mt-1">Optionnel.</p>
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-white/80 mb-1">Objectif</div>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white outline-none focus:border-white/25"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                  >
                    {OBJECTIVE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#070A12]">
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5">
                <div className="text-sm font-medium text-white/80 mb-2">Sports pratiqués</div>
                <div className="flex flex-wrap gap-2">
                  {SPORT_OPTIONS.map((s) => (
                    <Pill key={s} active={sports.includes(s)} onClick={() => toggleSport(s)} title="Multi-sélection">
                      {s}
                    </Pill>
                  ))}
                </div>
                <p className="text-xs text-white/40 mt-2">Tu peux en choisir plusieurs.</p>
              </div>
            </GlassCard>

            {/* Paramètres programmation */}
            <GlassCard className="p-5">
              <div>
                <div className="text-sm text-white/60">Programmation</div>
                <div className="mt-1 text-lg font-semibold">Préférences de planning</div>
                <p className="text-sm text-white/55 mt-2">
                  On utilisera ça pour générer un planning plus intelligent (jour de repos, volumes cibles, etc.).
                </p>
              </div>

              <div className="mt-5">
                <div className="text-sm font-medium text-white/80 mb-2">Jours disponibles</div>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <Pill
                      key={d.key}
                      active={availableDays.includes(d.key)}
                      onClick={() => toggleDay(d.key)}
                      title="Multi-sélection"
                    >
                      {d.label}
                    </Pill>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="block">
                  <div className="text-sm font-medium text-white/80 mb-1">Cible / semaine (heures)</div>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-white/30 outline-none focus:border-white/25"
                    value={weeklyTargetHours}
                    onChange={(e) => setWeeklyTargetHours(e.target.value)}
                    inputMode="decimal"
                    placeholder="4"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-white/80 mb-1">Cible / semaine (km)</div>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-white/30 outline-none focus:border-white/25"
                    value={weeklyTargetKm}
                    onChange={(e) => setWeeklyTargetKm(e.target.value)}
                    inputMode="decimal"
                    placeholder="30"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-white/80 mb-1">Jour de repos</div>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white outline-none focus:border-white/25"
                    value={restDay}
                    onChange={(e) => setRestDay(e.target.value)}
                  >
                    {DAYS.map((d) => (
                      <option key={d.key} value={d.key} className="bg-[#070A12]">
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-white/40 mt-1">S’affiche comme badge “Repos” sur la semaine.</p>
                </label>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-white/45">Stockage</div>
                <div className="mt-1 text-sm text-white/75">
                  <code className="text-white/80">profiles.planning_prefs</code>
                </div>
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </main>
  );
}