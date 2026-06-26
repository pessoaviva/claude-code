/**
 * Página de EXEMPLO (uma lista de itens com CRUD).
 *
 * 👉 Troque esta tela pela do negócio do cliente. Ela existe só para o template
 * já abrir funcionando e demonstrar a leitura/gravação de dados (que vai para o
 * localStorage cifrado OU para a nuvem, conforme a configuração — você não
 * precisa se preocupar com isso aqui).
 */
import { useState } from "react";
import type { DB } from "../lib/types";
import { today, uid } from "../lib/store";
import { Button, Card, EmptyState, Field, IconButton, Input, Table } from "../components/ui";

export function Items({ db, onChange }: { db: DB; onChange: (next: DB) => void }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onChange({ ...db, items: [...db.items, { id: uid(), title: t, note: note.trim(), done: false, createdAt: today() }] });
    setTitle("");
    setNote("");
  }

  function toggle(id: string) {
    onChange({ ...db, items: db.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) });
  }

  function remove(id: string) {
    if (!confirm("Excluir este item?")) return;
    onChange({ ...db, items: db.items.filter((i) => i.id !== id) });
  }

  const done = db.items.filter((i) => i.done).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Itens</h1>
        <p className="text-sm text-muted">
          {db.items.length} item(s){db.items.length > 0 && ` · ${done} concluído(s)`}. Esta é uma tela de exemplo — substitua pelo negócio do cliente.
        </p>
      </div>

      <Card title="Novo item">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Título">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Comprar material" />
          </Field>
          <Field label="Observação" hint="(opcional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalhes…" />
          </Field>
          <Button type="submit">+ Adicionar</Button>
        </form>
      </Card>

      {db.items.length === 0 ? (
        <EmptyState icon="🗂️">Nenhum item ainda. Adicione o primeiro acima.</EmptyState>
      ) : (
        <Card>
          <Table headers={["", "Título", "Observação", "Criado", ""]}>
            {db.items.map((i) => (
              <tr key={i.id} className="border-b border-line/50 transition hover:bg-line/30">
                <td className="px-3 py-3">
                  <input type="checkbox" checked={i.done} onChange={() => toggle(i.id)} className="h-4 w-4 accent-teal-600" />
                </td>
                <td className={`px-3 py-3 font-medium ${i.done ? "text-faint line-through" : ""}`}>{i.title}</td>
                <td className="px-3 py-3 text-muted">{i.note || "—"}</td>
                <td className="px-3 py-3 text-faint">{i.createdAt}</td>
                <td className="px-3 py-3 text-right">
                  <IconButton onClick={() => remove(i.id)} title="Excluir">🗑️</IconButton>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
