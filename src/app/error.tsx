"use client";

import { AuthBrand } from "@/components/company-brand";

export default function ErrorPage() {
  return (
    <main className="mx-auto max-w-lg p-10">
      <AuthBrand dark={false} />
      <h1 className="text-xl font-semibold">Não foi possível concluir.</h1>
      <p className="mt-2 text-sm text-slate-600">Tente de novo em instantes. O detalhe técnico ficou só no log do servidor.</p>
      <p className="mt-4 text-sm">
        <a className="text-teal-800" href="/login">Voltar ao login</a>
        {" · "}
        <a className="text-teal-800" href="/register">Criar conta da empresa</a>
      </p>
    </main>
  );
}
