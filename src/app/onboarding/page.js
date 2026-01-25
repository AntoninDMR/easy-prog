"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const SPORTS = ["course_a_pied", "velo", "natation"];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [sports, setSports] = useState([]);
  const [goal, setGoal] = useState("preparer_une_competition");

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/login");
        return;
      }

      setUserId(data.user.id);
      setLoading(false);
    }

    init();
  }, [router]);

  function toggleSport(s) {
    setSports((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!userId) return;

    const { error } = await supabase.from("profiles").upsert({
      user_id: userId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      age: age ? Number(age) : null,
      sports,
      goal,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      alert("Erreur profil: " + error.message);
      return;
    }

    router.push("/dashboard");
  }

  if (loading) return <p className="p-6">Chargement...</p>;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow w-[420px]">
        <h1 className="text-2xl font-bold mb-4 text-center">
          Compléter mon profil
        </h1>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            placeholder="Prénom"
            className="border px-3 py-2 rounded"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <input
            placeholder="Nom"
            className="border px-3 py-2 rounded"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
          <input
            type="number"
            placeholder="Âge"
            className="border px-3 py-2 rounded"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min="1"
            max="120"
          />

          <div className="border rounded p-3">
            <p className="font-semibold mb-2">Sports (plusieurs choix)</p>

            {SPORTS.map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sports.includes(s)}
                  onChange={() => toggleSport(s)}
                />
                <span>
                  {s === "course_a_pied"
                    ? "Course à pied"
                    : s === "velo"
                    ? "Vélo"
                    : "Natation"}
                </span>
              </label>
            ))}
          </div>

          <div className="border rounded p-3">
            <p className="font-semibold mb-2">Objectif (un seul choix)</p>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="goal"
                value="preparer_une_competition"
                checked={goal === "preparer_une_competition"}
                onChange={(e) => setGoal(e.target.value)}
              />
              Préparer une compétition
            </label>

            <label className="flex items-center gap-2 mt-2">
              <input
                type="radio"
                name="goal"
                value="me_maintenir_en_forme"
                checked={goal === "me_maintenir_en_forme"}
                onChange={(e) => setGoal(e.target.value)}
              />
              Me maintenir en forme
            </label>
          </div>

          <button type="submit" className="mt-2 bg-black text-white py-2 rounded">
            Enregistrer mon profil
          </button>
        </form>
      </div>
    </main>
  );
}