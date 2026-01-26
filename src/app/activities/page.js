"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

export default function ActivitiesPage() {
  const router = useRouter();

  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState("");

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal edit/create
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [name, setName] = useState("");
  const [color, setColor] = useState("#22c55e");
  const [unit, setUnit] = useState("km");

  const isEditing = useMemo(() => editingId != null, [editingId]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setColor("#22c55e");
    setUnit("km");
  }

  async function loadActivities(uid) {
    setLoading(true);
    const { data, error } = await supabase
      .from("activities")
      .select("id, name, color, distance_unit, created_at")
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
      const { data } = await supabase.auth.getUser();
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
    if (!userId) return;

    const cleanName = name.trim();
    if (!cleanName) {
      alert("Nom obligatoire");
      return;
    }

    // IMPORTANT : on met user_id + name pour le conflit (user_id,name)
    const payload = {
      user_id: userId,
      name: cleanName,
      color,
      distance_unit: unit,
      updated_at: new Date().toISOString(),
    };

    if (isEditing) {
      const { error } = await supabase.from("activities").update(payload).eq("id", editingId);
      if (error) {
        alert("Erreur update: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("activities")
        .insert({ ...payload, created_at: new Date().toISOString() });
      if (error) {
        alert("Erreur création: " + error.message);
        return;
      }
    }

    setOpen(false);
    resetForm();
    await loadActivities(userId);
  }

  async function handleDelete(a) {
    if (!confirm(`Supprimer l’activité "${a.name}" ?\n⚠️ Les séances liées garderont l’activity_id, donc elles risquent de ne plus s’afficher correctement.`)) {
      return;
    }

    const { error } = await supabase.from("activities").delete().eq("id", a.id);
    if (error) {
      alert("Erreur suppression: " + error.message);
      return;
    }

    await loadActivities(userId);
  }

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Mes activités</h1>
            <p className="text-gray-600 mt-1">{email}</p>
            <p className="text-gray-700 mt-4">
              Ici tu peux gérer tes sports (couleur, unité, ajout de Yoga rose, renfo, etc.).
            </p>
          </div>

          <div className="flex gap-2">
            <button
              className="px-4 py-2 border rounded"
              onClick={() => router.push("/dashboard")}
            >
              Retour dashboard
            </button>
            <button
              className="px-4 py-2 bg-black text-white rounded"
              onClick={openCreate}
            >
              + Nouvelle activité
            </button>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-xl shadow p-4">
          {loading ? (
            <p className="text-gray-600">Chargement…</p>
          ) : activities.length === 0 ? (
            <p className="text-gray-600">Aucune activité.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 p-3 rounded border bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-4 h-4 rounded" style={{ backgroundColor: a.color ?? "#999" }} />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{a.name}</p>
                      <p className="text-sm text-gray-600">Unité distance : {a.distance_unit}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="px-3 py-2 border rounded" onClick={() => openEdit(a)}>
                      Modifier
                    </button>
                    <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={() => handleDelete(a)}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal */}
        <Modal
          open={open}
          title={isEditing ? "Modifier l’activité" : "Nouvelle activité"}
          onClose={() => {
            setOpen(false);
            resetForm();
          }}
        >
          <div className="space-y-3">
            <label className="block">
              <div className="text-sm font-medium mb-1">Nom</div>
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Ex: Yoga"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <div className="text-sm font-medium mb-1">Couleur</div>
                <input
                  type="color"
                  className="border rounded px-3 py-2 h-[42px] w-full"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>

              <label className="block">
                <div className="text-sm font-medium mb-1">Unité distance</div>
                <select
                  className="border rounded px-3 py-2 w-full"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option value="km">km</option>
                  <option value="m">m</option>
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="px-4 py-2 border rounded" onClick={() => { setOpen(false); resetForm(); }}>
                Annuler
              </button>
              <button className="px-4 py-2 bg-black text-white rounded" onClick={handleSave}>
                Enregistrer
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </main>
  );
}