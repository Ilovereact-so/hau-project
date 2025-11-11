import Link from "next/link";

export default function NotFoundPage() {
  return (
    <>
      <h1 className="text-6xl font-bold text-blue-600">404</h1>
      <p className="mt-4 text-lg text-gray-700">Strona nie została znaleziona.</p>
      <Link
        href="/"
        className="mt-6 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800"
      >
        Wróć na stronę główną
      </Link>
    </>
  );
}
