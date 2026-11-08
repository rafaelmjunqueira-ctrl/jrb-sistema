-- Financeiro integrado ao Asaas (banco do escritório)
alter table clientes add column if not exists asaas_customer_id text unique;
alter table clientes add column if not exists email_cobranca text;

create table faturas (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references clientes(id) on delete cascade,
  asaas_id      text not null unique,          -- id da cobrança no Asaas (pay_...)
  assinatura_id text,                          -- sub_... quando vem da mensalidade
  descricao     text,
  valor         numeric(12,2) not null,
  vencimento    date not null,
  status        text not null,                 -- PENDING, OVERDUE, RECEIVED, CONFIRMED, REFUNDED...
  forma         text,                          -- BOLETO, PIX, CREDIT_CARD, UNDEFINED
  link_pagamento text,                         -- página do Asaas: Pix, boleto ou cartão
  link_boleto   text,
  pago_em       date,
  nf_numero     text,
  nf_status     text,
  nf_pdf        text,
  atualizado_em timestamptz not null default now()
);
create index on faturas (cliente_id, vencimento desc);

alter table faturas enable row level security;
create policy equipe_total on faturas for all using (eh_equipe()) with check (eh_equipe());
create policy cli_faturas  on faturas for select using (acessa_cliente(cliente_id));
