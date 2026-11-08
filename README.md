# JRB Sistema (beta)

Sistema da JRB Advogados Associados: área do escritório (sócios e funcionários) e painel do cliente
(saúde jurídica, processos, intimações, central jurídica). Next.js 14 + Supabase, hospedado na Vercel.

## Perfis
- **Sócio:** vê e altera tudo, gerencia usuários.
- **Funcionário:** vê e opera tudo (processos, prazos, chamados).
- **Cliente:** vê só as empresas às quais está vinculado, só andamentos liberados pelo escritório;
  envia intimações e abre chamados. Prazos, tarefas e notas internas nunca chegam ao cliente.
  As regras ficam no banco (RLS) — ver `supabase/migrations/0001_fundacao.sql`.

## Implantação (uma vez)
1. **Supabase:** crie o projeto (região São Paulo). Em *SQL Editor*, rode `supabase/migrations/0001_fundacao.sql`.
   Em *Authentication > Providers*, deixe e-mail ligado e **desligue o cadastro público** (o escritório cria os acessos).
2. **Primeiro sócio:** em *Authentication > Users > Add user*, crie seu usuário. Depois rode no SQL Editor:
   `update perfis set papel = 'socio', nome = 'Rafael Miguel Junqueira', oab = 'OAB/SP 406.185' where email = 'SEU_EMAIL';`
3. **GitHub:** suba este código para o repositório `jrb-sistema`.
4. **Vercel:** importe o repositório e cadastre `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (valores em Supabase > Project Settings > API Keys).
   Para criar acessos de clientes, cadastre também `SUPABASE_SECRET_KEY` (chave secret, tipo Secret, sem NEXT_PUBLIC_):
   ela é usada só no servidor e nunca chega ao navegador.

## Desenvolvimento local
```
cp .env.example .env.local   # preencher
npm install && npm run dev
```

## Teste das permissões
`supabase/tests/permissoes.test.mjs` aplica a migração num Postgres local (PGlite) e confere que um cliente
não enxerga dados de outro, nem prazos ou notas internas:
```
npm i -D @electric-sql/pglite && node supabase/tests/permissoes.test.mjs supabase/migrations/0001_fundacao.sql
```

## Próximas etapas
- Importação do acervo do painel atual (362 processos, andamentos e prazos).
- Coleta diária DJEN/DataJud gravando direto no banco (rotina agendada).
- Telas do escritório para triagem de intimações, resposta a chamados e liberação de andamentos ao cliente.
- Licitações (PNCP), certidões (Integra Contador/SERPRO) e CRM.
