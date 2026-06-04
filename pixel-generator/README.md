# Gerador de Pixel do Meta (Mercado Livre)

Ferramenta **estática e offline** (um único `index.html`, sem backend) que monta o
código do **Meta Pixel** já com o seu Pixel ID preenchido, pronto para copiar.

## Como usar

1. Abra `pixel-generator/index.html` no navegador (duplo clique já funciona).
2. Cole o **ID do Pixel** (15–16 dígitos) — pegue no *Gerenciador de Eventos do Meta*.
3. Marque os eventos que quer disparar (`ViewContent`, `AddToCart`, `Purchase`,
   `Lead`, etc.) e preencha os parâmetros (valor, IDs do produto, etc.).
4. Clique em **Copiar código** e cole dentro da `<head>` da sua página.

O código base já inclui `PageView`. Quando você informa `value`, a moeda `BRL` é
adicionada automaticamente.

## ⚠️ Sobre o Mercado Livre

O Mercado Livre **não permite inserir JavaScript** nos anúncios/lojas oficiais,
então este pixel **não roda dentro de um anúncio do ML**. Use-o em uma
**landing page / site próprio** que direciona o tráfego para os seus anúncios:

> Anúncio (Facebook/Instagram) → sua landing **com o pixel** → botão que leva ao anúncio no ML

Para registrar a **compra concluída dentro do ML**, o caminho correto é a
**Conversions API (server-side)**, enviando eventos a partir dos dados de pedido.
Essa parte pode ser adicionada depois.
