"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function checkUserAndProfile() {
      const { data } = await supabase.auth.getUser();

      // 1) Pas connecté -> login
      if (!data.user) {
        router.push("/login");
        return;
      }

      setEmail(data.user.email ?? "");

      // 2) Connecté mais pas de profil -> onboarding
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (error) {
        alert("Erreur profil: " + error.message);
        return;
      }

      if (!profile) {
        router.push("/onboarding");
        return;
      }
    }

    checkUserAndProfile();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3">
      <h1 className="text-3xl font-bold">Dashboard 🔐</h1>
      <p className="text-gray-600">Connecté en tant que : {email}</p>

      <button
        onClick={handleLogout}
        className="mt-2 px-4 py-2 bg-black text-white rounded"
      >
        Se déconnecter
      </button>
    </main>
  );
}