/**
 * Modelos de dados do sistema.
 *
 * 👉 Este é um EXEMPLO genérico (uma lista de itens). Ao montar o sistema do
 * cliente, troque `Item` e `DB` pelos modelos do negócio dele (ex.: clientes,
 * pedidos, contratos...). O resto da infraestrutura (login, nuvem, etc.) não
 * precisa mudar.
 */

/** Arquivo anexado (guardado como data URL base64). */
export interface FileAttachment {
  name: string;
  type: string; // MIME
  dataUrl: string; // base64
}

/** Um item de exemplo. Troque pelos campos do negócio do cliente. */
export interface Item {
  id: string;
  title: string;
  note: string;
  done: boolean;
  createdAt: string; // YYYY-MM-DD
}

/** O banco inteiro do app (o que é salvo/cifrado/sincronizado). */
export interface DB {
  items: Item[];
}
