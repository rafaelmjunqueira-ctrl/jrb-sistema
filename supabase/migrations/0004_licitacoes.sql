-- =====================================================================
-- Licitações: editais coletados do PNCP, preferências, acompanhamento
-- e histórico de alterações. Rodar uma vez no SQL Editor.
-- =====================================================================

create table editais (
  id               text primary key,              -- numeroControlePNCP
  orgao_cnpj       text not null,
  ano              int  not null,
  sequencial       int  not null,
  numero           text,
  processo         text,
  orgao_nome       text,
  unidade_nome     text,
  uf               text,
  municipio        text,
  esfera           text,                          -- F, E, M, D
  modalidade_id    int,
  modalidade       text,
  modo_disputa     text,
  srp              boolean,
  objeto           text not null,
  info_complementar text,
  valor_estimado   numeric(16,2),
  situacao_id      int,
  situacao         text,
  publicado_em     timestamptz,
  abertura_em      timestamptz,
  encerramento_em  timestamptz,
  atualizado_pncp  timestamptz,
  link_origem      text,
  n_arquivos       int,
  areas            text[] not null default '{}',
  texto_busca      text,                          -- objeto + órgão + município, sem acento (gerado na coleta)
  busca            tsvector generated always as (to_tsvector('portuguese', coalesce(texto_busca, ''))) stored,
  coletado_em      timestamptz not null default now(),
  unique (orgao_cnpj, ano, sequencial)
);
create index editais_busca_idx on editais using gin (busca);
create index editais_areas_idx on editais using gin (areas);
create index editais_enc_idx   on editais (encerramento_em);
create index editais_pub_idx   on editais (publicado_em desc);
create index editais_uf_idx    on editais (uf);

create table edital_eventos (
  id         bigserial primary key,
  edital_id  text not null references editais(id) on delete cascade,
  tipo       text not null,                       -- situacao, prazo, valor, objeto, arquivo
  descricao  text not null,
  criado_em  timestamptz not null default now()
);
create index on edital_eventos (edital_id, criado_em desc);

create table licitacao_preferencias (
  cliente_id    uuid primary key references clientes(id) on delete cascade,
  areas         text[] not null default '{}',
  ufs           text[] not null default '{}',
  palavras      text[] not null default '{}',
  excluir       text[] not null default '{}',
  modalidades   int[]  not null default '{}',
  valor_min     numeric(16,2),
  valor_max     numeric(16,2),
  ultima_visita timestamptz,
  atualizado_em timestamptz not null default now()
);

create table edital_acompanhamentos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references clientes(id) on delete cascade,
  edital_id   text not null references editais(id) on delete cascade,
  status      text not null default 'interesse',  -- interesse, analisando, participando, enviada, ganhamos, descartado
  nota        text,
  criado_por  uuid references perfis(id) default auth.uid(),
  criado_em   timestamptz not null default now(),
  visto_em    timestamptz not null default now(),
  unique (cliente_id, edital_id)
);

create table coleta_execucoes (
  id           bigserial primary key,
  iniciada_em  timestamptz not null default now(),
  pulso_em     timestamptz not null default now(),
  terminada_em timestamptz,
  status       text not null default 'rodando',   -- rodando, ok, erro
  cursor       jsonb not null default '{}'::jsonb,
  registros    int not null default 0,
  mensagem     text
);

alter table editais                 enable row level security;
alter table edital_eventos          enable row level security;
alter table licitacao_preferencias  enable row level security;
alter table edital_acompanhamentos  enable row level security;
alter table coleta_execucoes        enable row level security;

-- Editais são públicos (PNCP) para qualquer usuário logado; só a coleta (chave secreta) grava.
create policy editais_leitura on editais        for select using (auth.uid() is not null);
create policy eventos_leitura on edital_eventos for select using (auth.uid() is not null);
create policy pref_cliente    on licitacao_preferencias for all using (acessa_cliente(cliente_id)) with check (acessa_cliente(cliente_id));
create policy acomp_cliente   on edital_acompanhamentos for all using (acessa_cliente(cliente_id)) with check (acessa_cliente(cliente_id));
create policy coleta_equipe   on coleta_execucoes for select using (eh_equipe());

-- Busca com filtros. p_qualquer = true: casa por área OU por palavra-chave (modo "minhas preferências").
create or replace function buscar_editais(
  p_q text default null, p_areas text[] default null, p_ufs text[] default null, p_modalidades int[] default null,
  p_valor_min numeric default null, p_valor_max numeric default null, p_abertas boolean default true,
  p_excluir text default null, p_qualquer boolean default false, p_desde timestamptz default null,
  p_ordem text default 'encerramento', p_limite int default 30, p_offset int default 0
) returns table (
  id text, orgao_cnpj text, ano int, sequencial int, orgao_nome text, uf text, municipio text, modalidade text,
  objeto text, valor_estimado numeric, situacao_id int, situacao text, publicado_em timestamptz,
  encerramento_em timestamptz, areas text[], srp boolean, total bigint
) language sql stable security invoker set search_path = public as $$
  with alvo as (
    select e.* from editais e
    where (p_ufs is null or e.uf = any(p_ufs))
      and (p_modalidades is null or e.modalidade_id = any(p_modalidades))
      and (p_valor_min is null or e.valor_estimado >= p_valor_min)
      and (p_valor_max is null or e.valor_estimado <= p_valor_max)
      and (not p_abertas or (e.encerramento_em >= now() and coalesce(e.situacao_id, 1) in (1, 4)))
      and (p_desde is null or e.publicado_em >= p_desde)
      and (p_excluir is null or not e.busca @@ websearch_to_tsquery('portuguese', p_excluir))
      and (
        case when p_qualquer then
          (p_areas is null and p_q is null)
          or (p_areas is not null and e.areas && p_areas)
          or (p_q is not null and e.busca @@ websearch_to_tsquery('portuguese', p_q))
        else
          (p_areas is null or e.areas && p_areas)
          and (p_q is null or e.busca @@ websearch_to_tsquery('portuguese', p_q))
        end)
  )
  select a.id, a.orgao_cnpj, a.ano, a.sequencial, a.orgao_nome, a.uf, a.municipio, a.modalidade, a.objeto,
         a.valor_estimado, a.situacao_id, a.situacao, a.publicado_em, a.encerramento_em, a.areas, a.srp,
         count(*) over () as total
  from alvo a
  order by
    case when p_ordem = 'encerramento' then a.encerramento_em end asc nulls last,
    case when p_ordem = 'recentes' then a.publicado_em end desc nulls last,
    case when p_ordem = 'valor' then a.valor_estimado end desc nulls last,
    a.id
  limit least(greatest(p_limite, 1), 100) offset greatest(p_offset, 0);
$$;
