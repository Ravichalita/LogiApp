"use client";

import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-red-600 mb-4">Acesso Negado</h1>
      <p className="text-lg text-gray-700 mb-8">Você não tem permissão para acessar esta página.</p>
      <Link href="/">
        <a className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Voltar para a Página Inicial
        </a>
      </Link>
    </div>
  );
}
