import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex font-poppins flex-col items-center justify-center bg-[#0E0E0E] max-w-[405px] w-full shadow-lg rounded-[50px] p-12">
      <h1 className="text-6xl font-bold text-main">404</h1>
      <p className="mt-4 text-lg text-gray-300">Strona nie została znaleziona.</p>
      <Link
        href="/"
        className="mt-6 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800"
      >
        Wróć na stronę główną
      </Link>
    </div>
  );
}
