# Portal de assinaturas

Portal para empresas clientes gerenciarem assinaturas, faturas e chamados, com painel administrativo. Brasil usa Asaas (BRL). Os demais países usam Stripe. O gateway da empresa é fixo e o cartão só é digitado na página hospedada do provedor.

## Stack

Next.js, TypeScript, Tailwind, PostgreSQL, Prisma, Auth.js, pg-boss, Resend e Vitest.

## Subir localmente

1. Copie o ambiente e suba o Postgres:

```bash
copy .env.example .env
docker compose up -d
```

2. Gere o client, aplique o schema e crie o admin:

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
```

`ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env` definem o primeiro administrador. Não há cadastro público.

3. Rode a aplicação:

```bash
npm run dev
```

O processo do Next sobe o worker da fila (`START_WORKER` diferente de `false`). Em produção, deixe `START_WORKER=false` na web e rode `npm run worker` em outro processo.

## Variáveis

Veja `.env.example`. Segredos de Stripe, Asaas, Resend e storage ficam só no ambiente.

- `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`: modo teste do Stripe.
- `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`: sandbox (`ASAAS_API_URL` já aponta para a API sandbox).
- `RESEND_API_KEY` vazio: o worker registra o e-mail no log, e a tela mostra o link de convite para o admin.
- `STORAGE_DRIVER=local` grava anexos em `./uploads`. Com `STORAGE_DRIVER=s3`, use um bucket compatível (R2) e as variáveis `S3_*`.

## Webhooks no sandbox

O handler só valida e enfileira. Duplicata do mesmo id externo responde 200 sem processar de novo.

Stripe, com a CLI apontando para a rota local:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copie o `whsec_...` para `STRIPE_WEBHOOK_SECRET`.

Asaas sandbox: cadastre o webhook `https://<seu-tunel>/api/webhooks/asaas` com o mesmo valor de `ASAAS_WEBHOOK_TOKEN` no header `asaas-access-token`. Um túnel (cloudflared ou ngrok) é necessário para o Asaas alcançar a máquina.

Enquanto o webhook não chega, a lista de faturas tem **Atualizar do gateway**, que lê as cobranças pela camada `PaymentGateway`.

## Regras úteis

- Dono contrata, troca e cancela. Financeiro paga faturas. Técnico abre chamados e só lê serviços.
- Troca de plano vale no próximo ciclo.
- Cancelamento no Stripe segue até o fim do período. No Asaas o gateway encerra a assinatura.
- O Asaas não tem catálogo de produtos. Sincronizar o plano envia USD/EUR ao Stripe e mantém o valor em BRL local.

## Testes

```bash
npm test
```

Cobrem permissões, isolamento por empresa, regras de gateway, idempotência de webhook e os adaptadores com clientes falsos.

## Fora desta entrega

MRR, régua de inadimplência, reconciliação agendada, 2FA, nota fiscal, WhatsApp, FAQ e API pública.
