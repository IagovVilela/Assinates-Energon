"use client";

export default function ErrorPage() {
  return (
    <main className="mx-auto max-w-lg p-10">
      <h1 className="text-xl font-semibold">Não foi possível concluir.</h1>
      <p className="mt-2 text-sm text-slate-600">Tente de novo em instantes. O detalhe técnico ficou só no log do servidor.</p>
    </main>
  );
}
