import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-100 px-6">
      <h1 className="text-4xl font-bold">Easy Prog</h1>

      <p className="text-gray-600 text-center max-w-md">
        Crée ton compte et commence à suivre ton profil sportif.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
        <Link href="/signup" className="w-full">
          <button className="w-full px-4 py-2 bg-black text-white rounded">
            Créer un compte
          </button>
        </Link>

        <Link href="/login" className="w-full">
          <button className="w-full px-4 py-2 bg-white border rounded">
            J’ai déjà un compte — me connecter
          </button>
        </Link>
      </div>
    </main>
  );
}