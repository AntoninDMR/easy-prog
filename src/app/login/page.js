"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const isLogin = mode === "login";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 6 && !loading;
  }, [email, password, loading]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;

        router.push("/dashboard");
        return;
      }

      // signup
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      // Si confirmation email activée, l'utilisateur devra peut-être valider avant de pouvoir se connecter.
      setInfoMsg(
        "Compte créé ✅ Si une confirmation email est activée, vérifie ta boîte mail, puis connecte-toi."
      );
      setMode("login");
      setPassword("");
    } catch (err) {
      setErrorMsg(err?.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-12 text-white">
      {/* background dark + glow (comme dashboard) */}
      <div className="fixed inset-0 -z-10 bg-[#070A12]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(900px_500px_at_15%_10%,rgba(120,119,198,0.22),transparent_60%),radial-gradient(900px_500px_at_85%_10%,rgba(56,189,248,0.16),transparent_60%),radial-gradient(900px_500px_at_50%_85%,rgba(34,197,94,0.10),transparent_60%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_35%,rgba(0,0,0,0.35))]" />

      <div className="mx-auto w-full max-w-6xl">
        {/* top bar minimal */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 backdrop-blur flex items-center justify-center">
              <span className="text-lg">⚡️</span>
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">EasyProg</div>
              <div className="text-xs text-white/60">Planifier • Faire • Progresser</div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-white/60">
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur">
              Prévu vs Réalisé ✅
            </span>
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur">
              Drag & drop
            </span>
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur">
              Stats par sport
            </span>
          </div>
        </div>

        {/* content */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* marketing */}
          <section className="pt-2">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
              Ton planning d’entraînement,
              <span className="text-white/70"> enfin clair.</span>
            </h1>

            <p className="mt-4 text-white/65 text-lg max-w-xl">
              Construis ta semaine, coche ce que tu as vraiment fait, et vois immédiatement
              la différence entre <span className="text-white/80">prévu</span> et{" "}
              <span className="text-white/80">réalisé</span>.
            </p>

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
                <div className="text-sm font-semibold">Planning ultra lisible</div>
                <div className="mt-1 text-sm text-white/60">
                  7 jours, drag & drop, repos visible, cards propres.
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
                <div className="text-sm font-semibold">Stats utiles</div>
                <div className="mt-1 text-sm text-white/60">
                  Charge par activité + volume par jour, prévu vs fait.
                </div>
              </div>
            </div>

            {/* mini “preview” */}
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white/85">Aperçu</div>
                <div className="text-xs text-white/55">Semaine en cours</div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { t: "Course", s: "45 min • 10 km", c: "rgba(34,197,94,0.22)" },
                  { t: "Vélo", s: "60 min • 25 km", c: "rgba(249,115,22,0.18)" },
                  { t: "Natation", s: "30 min • 1500 m", c: "rgba(59,130,246,0.18)" },
                ].map((x, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-white/10 p-3"
                    style={{ backgroundColor: x.c }}
                  >
                    <div className="text-sm font-semibold">{x.t}</div>
                    <div className="mt-1 text-xs text-white/70">{x.s}</div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-white/55">
                      <span>Prévu</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">
                        ✓ fait
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* auth card */}
          <section className="lg:pl-8">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-6 sm:p-7 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-2xl font-semibold tracking-tight">
                    {isLogin ? "Connexion" : "Créer un compte"}
                  </div>
                  <div className="mt-1 text-sm text-white/60">
                    {isLogin
                      ? "Accède à ton dashboard et ton planning."
                      : "En 30 secondes, et c’est parti."}
                  </div>
                </div>

                {/* segmented control */}
                <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setErrorMsg("");
                      setInfoMsg("");
                    }}
                    className={cx(
                      "px-3 py-1.5 text-sm rounded-full transition",
                      isLogin ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
                    )}
                  >
                    Connexion
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setErrorMsg("");
                      setInfoMsg("");
                    }}
                    className={cx(
                      "px-3 py-1.5 text-sm rounded-full transition",
                      !isLogin ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
                    )}
                  >
                    Inscription
                  </button>
                </div>
              </div>

              {/* messages */}
              {errorMsg ? (
                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {errorMsg}
                </div>
              ) : null}

              {infoMsg ? (
                <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {infoMsg}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <label className="block">
                  <div className="text-sm font-medium text-white/80 mb-1">Email</div>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="toi@exemple.com"
                    className={cx(
                      "w-full rounded-2xl px-4 py-3",
                      "bg-white/5 border border-white/10 text-white placeholder:text-white/35",
                      "outline-none focus:ring-2 focus:ring-cyan-300/40 focus:border-white/20"
                    )}
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-white/80 mb-1">Mot de passe</div>
                  <input
                    type="password"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isLogin ? "••••••••" : "6 caractères minimum"}
                    className={cx(
                      "w-full rounded-2xl px-4 py-3",
                      "bg-white/5 border border-white/10 text-white placeholder:text-white/35",
                      "outline-none focus:ring-2 focus:ring-cyan-300/40 focus:border-white/20"
                    )}
                  />
                  {!isLogin ? (
                    <div className="mt-2 text-xs text-white/50">
                      Astuce : utilise au moins 6 caractères (Supabase).
                    </div>
                  ) : null}
                </label>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cx(
                    "w-full rounded-2xl py-3 font-semibold transition",
                    "bg-white text-black hover:bg-white/90",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {loading
                    ? "Chargement…"
                    : isLogin
                    ? "Se connecter"
                    : "Créer mon compte"}
                </button>

                <div className="flex items-center justify-between text-xs text-white/55">
                  <span>
                    {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode(isLogin ? "signup" : "login");
                      setErrorMsg("");
                      setInfoMsg("");
                      setPassword("");
                    }}
                    className="text-white/80 hover:text-white underline underline-offset-4"
                  >
                    {isLogin ? "Inscription" : "Connexion"}
                  </button>
                </div>

                {/* Optionnel: mot de passe oublié (si tu veux le câbler plus tard) */}
                <div className="pt-2 text-xs text-white/45">
                  En continuant, tu acceptes une expérience simple, sans blabla.
                </div>
              </form>
            </div>

            <div className="mt-4 text-xs text-white/40 text-center">
              © {new Date().getFullYear()} — TimeZero
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}