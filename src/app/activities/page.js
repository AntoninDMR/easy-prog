"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import HeaderBar from "@/components/HeaderBar";

/* ---------------- UI primitives ---------------- */

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

export default function ActivitiesPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activities, setActivities] = useState([]);

  // modal
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const isEditing = useMemo(() => editingId != null, [editingId]);

  // form
  const [name, setName] = useState("");
  const [color, setColor] = useState("#22c55e");
  const [unit, setUnit] = useState("km");

  function resetForm() {
    setEditingId(null);
    setName("");
    setColor("#22c55e");
    setUnit("km");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function loadActivities(uid) {
    setLoading(true);
    const { data, error } = await supabase
      .from("activities")
      .select("id, name, color, distance_unit")
      .eq("user_id", uid)
      .order("name", { ascending: true });

    setLoading(false);

    if (error) {
      alert("Erreur chargement activités: " + error.message);
      return;
    }
    setActivities(data ?? []);
  }

  useEffect(() => {
    async function init() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        alert("Erreur session: " + error.message);
        router.push("/login");
        return;
      }
      if (!data.user) {
        router.push("/login");
        return;
      }

      setUserId(data.user.id);
      setEmail(data.user.email ?? "");

      await loadActivities(data.user.id);
    }

    init();
  }, [router]);

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(a) {
    setEditingId(a.id);
    setName(a.name ?? "");
    setColor(a.color ?? "#22c55e");
    setUnit(a.distance_unit ?? "km");
    setOpen(true);
  }

  async function handleSave() {
    try {
      if (!userId) {
        alert("UserId non chargé (attends 1 seconde et réessaie).");
        return;
      }

      const cleanName = name.trim();
      if (!cleanName) {
        alert("Nom obligatoire");
        return;
      }

      setSaving(true);

      if (isEditing) {
        const { error } = await supabase
          .from("activities")
          .update({
            name: cleanName,
            color,
            distance_unit: unit,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("activities").insert({
          user_id: userId,
          name: cleanName,
          color,
          distance_unit: unit,
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;
      }

      setOpen(false);
      resetForm();
      await loadActivities(userId);
    } catch (e) {
      alert("Erreur sauvegarde: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a) {
    try {
      if (!userId) return;

      const ok = confirm(`Supprimer l’activité "${a.name}" ?`);
      if (!ok) return;

      setSaving(true);

      const { error } = await supabase
        .from("activities")
        .delete()
        .eq("id", a.id)
        .eq("user_id", userId);

      if (error) throw error;

      await loadActivities(userId);
    } catch (e) {
      alert("Erreur suppression: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
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

      <div className="max-w-4xl mx-auto mt-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white/90">Mes activités</h1>
            <p className="text-sm text-white/50 mt-1">{email}</p>
            <p className="text-white/65 mt-4 font-medium">
              Gère tes sports (couleur, unité). Ex: Yoga rose, Renfo, Stretching…
            </p>
          </div>

          <button
            type="button"
            className={[
              "px-4 py-2 rounded-xl",
              "bg-white text-black hover:bg-white/90 transition",
              "shadow-[0_10px_24px_rgba(0,0,0,0.35)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
            onClick={openCreate}
            disabled={!userId || loading}
          >
            + Ajouter
          </button>
        </div>

        <GlassCard className="mt-8 p-4">
          {loading ? (
            <p className="text-white/55">Chargement…</p>
          ) : activities.length === 0 ? (
            <p className="text-white/55">Aucune activité pour l’instant.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => (
                <div
                  key={a.id}
                  className={[
                    "flex items-center justify-between gap-3 p-3 rounded-2xl",
                    "border border-white/10 bg-white/[0.04] hover:bg-white/[0.07]",
                    "transition shadow-[0_10px_24px_rgba(0,0,0,0.25)]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: a.color ?? "#999" }}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-white/90 truncate">{a.name}</p>
                      <p className="text-sm text-white/55">Unité : {a.distance_unit}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
                      onClick={() => openEdit(a)}
                      disabled={saving}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="px-3 py-2 rounded-xl bg-red-500/90 text-white hover:bg-red-500 transition disabled:opacity-50"
                      onClick={() => handleDelete(a)}
                      disabled={saving}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Modal create/edit */}
        <Modal
          open={open}
          title={isEditing ? "Modifier l’activité" : "Ajouter une activité"}
          onClose={() => {
            setOpen(false);
            resetForm();
          }}
        >
          <div className="space-y-3">
            <label className="block">
              <div className="text-sm font-medium mb-1 text-white/85">Nom</div>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                placeholder="Ex: Yoga"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <div className="text-sm font-medium mb-1 text-white/85">Couleur</div>
                <input
                  type="color"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 h-[42px] w-full"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>

              <label className="block">
                <div className="text-sm font-medium mb-1 text-white/85">Unité distance</div>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option value="km" className="text-black">
                    km
                  </option>
                  <option value="m" className="text-black">
                    m
                  </option>
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                disabled={saving}
              >
                Annuler
              </button>

              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 transition disabled:opacity-50"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </main>
  );
}