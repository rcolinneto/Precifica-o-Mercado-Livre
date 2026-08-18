import Link from "next/link";
import { sair } from "./actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
          <Link href="/produtos" className="font-semibold text-gray-900">
            Precificador Dipil
          </Link>
          <form action={sair}>
            <button type="submit" className="text-sm text-gray-600 underline">
              Sair
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
