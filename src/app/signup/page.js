"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const SPORTS = ["course a pied", "vélo", "natation"];
const GOALS = ["préparer une competition", "me maintenir en forme"];

export default function SignupPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [sports, setSports] = useState([]); // tableau
  const [goal, setGoal] = useState(GOALS[0]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const toggleSport = (sport) => {
    setSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  };

  async function handleSubmit(e) {
    e.preventDefault();

    // 1) Créer l’utilisateur (Auth)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      alert("Erreur signup: " + signUpError.message);
      return;
    }

    const userId = signUpData?.user?.id;

    // Si Supabase demande une confirmation email, user peut être null selon config.
    // Dans ce cas, on ne peut pas écrire dans profiles tout de suite.
    if (!userId) {
      alert(
        "Compte créé ✅. Tu dois peut-être confirmer ton email. Une fois confirmé, reconnecte-toi et on complètera ton profil."
      );
      router.push("/login");
      return;
    }

    // 2) Enregistrer le profil (DB)
    const { error: profileError } = await supabase.from("profiles").insert({
      user_id: userId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      age: age ? Number(age) : null,
      sports,
      goal,
    });

    if (profileError) {
      alert("Erreur profil: " + profileError.message);
      return;
    }

    alert("Compte + profil enregistrés 🎉");
    router.push("/login");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow w-[360px]">
        <h1 className="text-2xl font-bold mb-4 text-center">Créer un compte</h1>

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
            <p className="font-semibold mb-2">Sport pratiqué (plusieurs choix)</p>
            <div className="flex flex-col gap-2">
              {SPORTS.map((s) => (
                <label key={s} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={sports.includes(s)}
                    onChange={() => toggleSport(s)}
                  />
                  <span>{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border rounded p-3">
            <p className="font-semibold mb-2">Objectif (un seul choix)</p>
            <select
              className="border px-3 py-2 rounded w-full"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            >
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <input
            type="email"
            placeholder="Email"
            className="border px-3 py-2 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Mot de passe (min 6 caractères)"
            className="border px-3 py-2 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          <button type="submit" className="mt-2 bg-black text-white py-2 rounded">
            Créer mon compte
          </button>
        </form>

        <p className="text-sm text-gray-600 mt-4 text-center">
          Déjà un compte ?{" "}
          <Link href="/login" className="underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}