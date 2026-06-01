import { useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { brl, pct, signColor } from "../lib/format";
import { Banner, Button, Card, Input, Select, Table } from "../components/ui";

interface Product { id: string; sku: string; name: string; stock_qty: string }
interface Profit { productId: string; name: string; sku: string; qtySold: string; revenue: string; cogs: string; profit: string; marginPct: string }

export function Sales() {
  const products = useFetch<Product[]>(() => api.get("/sales/products"));
  const profit = useFetch<Profit[]>(() => api.get("/sales/profit"));
  const [prodForm, setProdForm] = useState({ sku: "", name: "" });
  const [buyForm, setBuyForm] = useState({ productId: "", qty: "", unitCost: "" });
  const [sellForm, setSellForm] = useState({ productId: "", qty: "", unitPrice: "" });
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function run(fn: () => Promise<void>, success: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: "success", text: success });
      await Promise.all([products.reload(), profit.reload()]);
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    }
  }

  const opts = (products.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>);

  return (
    <div className="space-y-4">
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Novo produto">
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post("/sales/products", prodForm); setProdForm({ sku: "", name: "" }); }, "Produto criado."); }}>
            <Input placeholder="SKU" value={prodForm.sku} onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })} required />
            <Input placeholder="Nome" value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} required />
            <Button type="submit" className="w-full">Cadastrar</Button>
          </form>
        </Card>

        <Card title="Compra (entrada de estoque)">
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post("/sales/purchases", { ...buyForm, productId: Number(buyForm.productId) }); setBuyForm({ productId: "", qty: "", unitCost: "" }); }, "Compra registrada."); }}>
            <Select value={buyForm.productId} onChange={(e) => setBuyForm({ ...buyForm, productId: e.target.value })} required>
              <option value="">Selecione…</option>{opts}
            </Select>
            <Input type="number" step="0.001" placeholder="Qtd" value={buyForm.qty} onChange={(e) => setBuyForm({ ...buyForm, qty: e.target.value })} required />
            <Input type="number" step="0.01" placeholder="Custo unitário" value={buyForm.unitCost} onChange={(e) => setBuyForm({ ...buyForm, unitCost: e.target.value })} required />
            <Button type="submit" className="w-full">Registrar compra</Button>
          </form>
        </Card>

        <Card title="Venda (saída de estoque)">
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post("/sales/sales", { ...sellForm, productId: Number(sellForm.productId) }); setSellForm({ productId: "", qty: "", unitPrice: "" }); }, "Venda registrada."); }}>
            <Select value={sellForm.productId} onChange={(e) => setSellForm({ ...sellForm, productId: e.target.value })} required>
              <option value="">Selecione…</option>{opts}
            </Select>
            <Input type="number" step="0.001" placeholder="Qtd" value={sellForm.qty} onChange={(e) => setSellForm({ ...sellForm, qty: e.target.value })} required />
            <Input type="number" step="0.01" placeholder="Preço unitário" value={sellForm.unitPrice} onChange={(e) => setSellForm({ ...sellForm, unitPrice: e.target.value })} required />
            <Button type="submit" className="w-full">Registrar venda</Button>
          </form>
        </Card>
      </div>

      <Card title="Estoque atual">
        {products.data && (
          <Table headers={["SKU", "Produto", "Estoque"]}>
            {products.data.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/50">
                <td className="px-2 py-2">{p.sku}</td>
                <td className="px-2 py-2">{p.name}</td>
                <td className="px-2 py-2">{Number(p.stock_qty)}</td>
              </tr>
            ))}
            {products.data.length === 0 && <tr><td colSpan={3} className="px-2 py-4 text-center text-slate-500">Nenhum produto.</td></tr>}
          </Table>
        )}
      </Card>

      <Card title="Lucro por produto">
        {profit.data && (
          <Table headers={["Produto", "Qtd vendida", "Receita", "Custo (COGS)", "Lucro", "Margem"]}>
            {profit.data.map((p) => (
              <tr key={p.productId} className="border-b border-slate-800/50">
                <td className="px-2 py-2">{p.name}</td>
                <td className="px-2 py-2">{Number(p.qtySold)}</td>
                <td className="px-2 py-2">{brl(p.revenue)}</td>
                <td className="px-2 py-2">{brl(p.cogs)}</td>
                <td className={`px-2 py-2 ${signColor(p.profit)}`}>{brl(p.profit)}</td>
                <td className={`px-2 py-2 ${signColor(p.marginPct)}`}>{pct(p.marginPct)}</td>
              </tr>
            ))}
            {profit.data.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-center text-slate-500">Nenhuma venda registrada.</td></tr>}
          </Table>
        )}
      </Card>
    </div>
  );
}
