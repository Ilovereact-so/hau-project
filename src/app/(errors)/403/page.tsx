import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <>
      <h1 className="text-6xl font-bold text-red-600">403</h1>
      <p className="mt-4 text-lg text-gray-700">
        Nie masz uprawnień do tej strony.
      </p>
      <Link
        href="/"
        className="mt-6 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800"
      >
        Wróć na stronę główną
      </Link>
    </>
  );
}
