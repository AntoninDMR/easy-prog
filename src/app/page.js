import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-100">
      <h1 className="text-4xl font-bold">Easy Prog</h1>
      <p className="text-gray-600">Mon site est en ligne 🎉</p>

      <Link href="/login">
        <button className="mt-4 px-4 py-2 bg-black text-white rounded">
          Aller à la connexion
        </button>
      </Link>
    </main>
  );
}