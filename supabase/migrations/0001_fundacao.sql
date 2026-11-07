-- =====================================================================
-- JRB Sistema — Fase 0 (fundação) + Fase 1 (painel do cliente)
-- Banco: Supabase (Postgres). Rodar no SQL Editor do projeto, uma vez.
-- Regra central: equipe (sócio/funcionário) vê tudo; cliente vê só o que
-- é dele e só o que estiver marcado como visível ao cliente.
-- =====================================================================


-- ---------- Tipos ----------
create type papel_usuario   as enum ('socio', 'funcionario', 'cliente');
create type tipo_pessoa     as enum ('PF', 'PJ');
create type nivel_risco     as enum ('baixo', 'medio', 'alto', 'indefinido');
create type status_chamado  as enum ('aberto', 'em_analise', 'em_execucao', 'aguardando_cliente', 'concluido', 'cancelado');
create type tipo_chamado    as enum ('impugnacao', 'recurso_administrativo', 'mandado_seguranca', 'consulta', 'documento', 'outro');
create type status_intimacao as enum ('recebida', 'em_triagem', 'triada', 'descartada');
create type tipo_vencimento as enum ('audiencia', 'certidao', 'contrato', 'documento', 'licitacao', 'outro');

-- ---------- Pessoas e acesso ----------
create table clientes (
  id              uuid primary key default gen_random_uuid(),
  tipo            tipo_pessoa not null,
  nome            text not null,
  documento       text unique,                -- CPF ou CNPJ, só dígitos
  cnaes           text[] default '{}',
  perfil_licitacao jsonb default '{}'::jsonb,  -- palavras-chave, UFs, valor mínimo etc.
  plano           text default 'beta',
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now()
);

create table perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null,
  email      text,
  papel      papel_usuario not null default 'cliente',
  oab        text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- um usuário de cliente pode acessar mais de uma empresa (ex.: grupo econômico)
create table cliente_membros (
  cliente_id uuid references clientes(id) on delete cascade,
  usuario_id uuid references perfis(id)  on delete cascade,
  primary key (cliente_id, usuario_id)
);

-- ---------- Funções de permissão ----------
create or replace function eh_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis
                 where id = auth.uid() and ativo and papel in ('socio','funcionario'));
$$;

create or replace function eh_socio() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo and papel = 'socio');
$$;

create or replace function acessa_cliente(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eh_equipe() or exists (
    select 1 from cliente_membros m join perfis p on p.id = m.usuario_id
    where m.cliente_id = cid and m.usuario_id = auth.uid() and p.ativo);
$$;

-- ---------- Processos ----------
create table processos (
  id                 uuid primary key default gen_random_uuid(),
  numero_cnj         text not null unique,
  tribunal           text,
  orgao_julgador     text,
  classe             text,
  assunto            text,
  valor_causa        numeric(14,2),
  advogado_resp      uuid references perfis(id),
  situacao           text default 'ativo',      -- ativo, suspenso, arquivado, baixado
  risco              nivel_risco not null default 'indefinido',
  exposicao_estimada numeric(14,2),             -- provisionamento (visão do cliente)
  resumo_cliente     text,                      -- explicação em linguagem simples
  ultima_mov_em      timestamptz,
  criado_em          timestamptz not null default now()
);

create table processo_clientes (
  processo_id uuid references processos(id) on delete cascade,
  cliente_id  uuid references clientes(id)  on delete cascade,
  polo        text,                              -- ativo / passivo / terceiro
  primary key (processo_id, cliente_id)
);

create table andamentos (
  id               uuid primary key default gen_random_uuid(),
  processo_id      uuid not null references processos(id) on delete cascade,
  data             timestamptz not null,
  fonte            text not null,                -- DJEN, DataJud, manual, agregador
  texto_original   text,
  resumo_simples   text,                         -- o que o cliente lê
  visivel_cliente  boolean not null default false, -- equipe libera
  hash             text unique,                  -- evita duplicata na coleta
  criado_em        timestamptz not null default now()
);
create index on andamentos (processo_id, data desc);

-- notas internas ficam em tabela separada: o cliente lê "processos", nunca isto
create table processo_notas (
  processo_id uuid primary key references processos(id) on delete cascade,
  nota        text,
  atualizado_em timestamptz not null default now()
);

-- prazos e tarefas: SÓ equipe
create table prazos (
  id           uuid primary key default gen_random_uuid(),
  processo_id  uuid references processos(id) on delete cascade,
  descricao    text not null,
  data_fatal   date not null,
  data_segura  date,
  responsavel  uuid references perfis(id),
  concluido    boolean not null default false,
  concluido_por uuid references perfis(id),
  concluido_em timestamptz,
  criado_em    timestamptz not null default now()
);

create table tarefas (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references clientes(id) on delete set null,
  processo_id uuid references processos(id) on delete set null,
  titulo      text not null,
  detalhe     text,
  vence_em    date,
  responsavel uuid references perfis(id),
  feita       boolean not null default false,
  criado_por  uuid references perfis(id) default auth.uid(),
  criado_em   timestamptz not null default now()
);

-- ---------- Recursos do cliente ----------
-- "Recebi uma intimação / um processo novo"
create table intimacoes_enviadas (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references clientes(id) on delete cascade,
  enviado_por  uuid references perfis(id) default auth.uid(),
  arquivo_path text,                             -- storage: documentos/<cliente_id>/...
  observacao   text,
  status       status_intimacao not null default 'recebida',
  processo_id  uuid references processos(id),
  retorno_cliente text,                          -- resposta do escritório
  criado_em    timestamptz not null default now()
);

-- Central jurídica
create table chamados (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references clientes(id) on delete cascade,
  tipo         tipo_chamado not null,
  titulo       text not null,
  descricao    text,
  referencia   text,                             -- nº do edital, processo, contrato
  prazo_cliente date,                            -- prazo informado pelo cliente
  status       status_chamado not null default 'aberto',
  responsavel  uuid references perfis(id),
  aberto_por   uuid references perfis(id) default auth.uid(),
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table chamado_mensagens (
  id         uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references chamados(id) on delete cascade,
  autor      uuid references perfis(id) default auth.uid(),
  texto      text not null,
  interna    boolean not null default false,     -- nota interna da equipe
  criado_em  timestamptz not null default now()
);

create table vencimentos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references clientes(id) on delete cascade,
  tipo        tipo_vencimento not null,
  descricao   text not null,
  data        date not null,
  origem_id   uuid,                               -- processo, certidão, documento...
  criado_em   timestamptz not null default now()
);

create table certidoes (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references clientes(id) on delete cascade,
  tipo         text not null,                     -- federal, FGTS, trabalhista, estadual, municipal, falência
  orgao        text,
  situacao     text,                              -- negativa, positiva c/ efeito de negativa, positiva
  emitida_em   date,
  validade     date,
  pendencias   jsonb default '[]'::jsonb,         -- causas impeditivas (SITFIS etc.)
  arquivo_path text,
  atualizado_em timestamptz not null default now()
);

create table documentos (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references clientes(id) on delete cascade,
  categoria    text not null,                     -- habilitacao, societario, contrato, atestado, outro
  nome         text not null,
  validade     date,
  arquivo_path text,
  enviado_por  uuid references perfis(id) default auth.uid(),
  criado_em    timestamptz not null default now()
);

-- Auditoria simples (quem fez o quê)
create table auditoria (
  id        bigserial primary key,
  usuario   uuid default auth.uid(),
  acao      text not null,
  tabela    text,
  registro  uuid,
  detalhe   jsonb,
  criado_em timestamptz not null default now()
);

-- =====================================================================
-- RLS
-- =====================================================================
alter table clientes            enable row level security;
alter table perfis              enable row level security;
alter table cliente_membros     enable row level security;
alter table processos           enable row level security;
alter table processo_clientes   enable row level security;
alter table processo_notas      enable row level security;
alter table andamentos          enable row level security;
alter table prazos              enable row level security;
alter table tarefas             enable row level security;
alter table intimacoes_enviadas enable row level security;
alter table chamados            enable row level security;
alter table chamado_mensagens   enable row level security;
alter table vencimentos         enable row level security;
alter table certidoes           enable row level security;
alter table documentos          enable row level security;
alter table auditoria           enable row level security;

-- Equipe: acesso total às tabelas operacionais
do $$
declare t text;
begin
  foreach t in array array['clientes','cliente_membros','processos','processo_clientes','processo_notas',
    'andamentos','prazos','tarefas','intimacoes_enviadas','chamados','chamado_mensagens',
    'vencimentos','certidoes','documentos']
  loop
    execute format('create policy equipe_total on %I for all using (eh_equipe()) with check (eh_equipe())', t);
  end loop;
end $$;

-- Perfis: cada um vê o próprio; equipe vê todos; só sócio altera papéis
create policy perfil_proprio  on perfis for select using (id = auth.uid() or eh_equipe());
create policy perfil_socio    on perfis for all    using (eh_socio()) with check (eh_socio());

-- Auditoria: equipe lê; qualquer logado registra
create policy aud_le     on auditoria for select using (eh_equipe());
create policy aud_insere on auditoria for insert with check (auth.uid() is not null);

-- Cliente: leitura do que é dele
create policy cli_clientes on clientes for select using (acessa_cliente(id));
create policy cli_membros  on cliente_membros for select using (usuario_id = auth.uid());

create policy cli_proc_cli on processo_clientes for select using (acessa_cliente(cliente_id));
create policy cli_processos on processos for select using (
  exists (select 1 from processo_clientes pc where pc.processo_id = processos.id and acessa_cliente(pc.cliente_id)));
create policy cli_andamentos on andamentos for select using (
  visivel_cliente and exists (select 1 from processo_clientes pc
    where pc.processo_id = andamentos.processo_id and acessa_cliente(pc.cliente_id)));

create policy cli_venc  on vencimentos for select using (acessa_cliente(cliente_id));
create policy cli_cert  on certidoes   for select using (acessa_cliente(cliente_id));

-- Cliente: leitura + envio
create policy cli_doc_le  on documentos for select using (acessa_cliente(cliente_id));
create policy cli_doc_env on documentos for insert with check (acessa_cliente(cliente_id));

create policy cli_int_le  on intimacoes_enviadas for select using (acessa_cliente(cliente_id));
create policy cli_int_env on intimacoes_enviadas for insert with check (acessa_cliente(cliente_id) and status = 'recebida');

create policy cli_cham_le  on chamados for select using (acessa_cliente(cliente_id));
create policy cli_cham_abr on chamados for insert with check (acessa_cliente(cliente_id) and status = 'aberto');

create policy cli_msg_le on chamado_mensagens for select using (
  not interna and exists (select 1 from chamados c where c.id = chamado_id and acessa_cliente(c.cliente_id)));
create policy cli_msg_env on chamado_mensagens for insert with check (
  not interna and exists (select 1 from chamados c where c.id = chamado_id and acessa_cliente(c.cliente_id)));

-- Visão do cliente sobre processos (colunas pensadas para leitura do cliente)
create view processos_cliente with (security_invoker = true) as
  select id, numero_cnj, tribunal, orgao_julgador, classe, assunto, valor_causa,
         situacao, risco, exposicao_estimada, resumo_cliente, ultima_mov_em
  from processos;

-- =====================================================================
-- Novo usuário: cria perfil como 'cliente' (sócio promove depois)
-- =====================================================================
create or replace function novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome, email, papel)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), new.email, 'cliente');
  return new;
end $$;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function novo_usuario();

-- =====================================================================
-- Storage: bucket privado "documentos", pasta = cliente_id
-- =====================================================================
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false)
  on conflict (id) do nothing;

create policy docs_le on storage.objects for select using (
  bucket_id = 'documentos' and acessa_cliente(((storage.foldername(name))[1])::uuid));
create policy docs_envia on storage.objects for insert with check (
  bucket_id = 'documentos' and acessa_cliente(((storage.foldername(name))[1])::uuid));
create policy docs_equipe on storage.objects for all using (
  bucket_id = 'documentos' and eh_equipe()) with check (bucket_id = 'documentos' and eh_equipe());
