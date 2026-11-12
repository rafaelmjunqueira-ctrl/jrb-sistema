-- =====================================================================
-- Editais de outras fontes além do PNCP (Diário Oficial da União; depois DOEs e diários municipais)
-- =====================================================================
alter table editais add column if not exists fonte text not null default 'pncp';
alter table editais add column if not exists url_fonte text;
alter table editais add column if not exists texto text;
alter table editais alter column orgao_cnpj drop not null;
alter table editais alter column ano drop not null;
alter table editais alter column sequencial drop not null;
create index if not exists editais_fonte_idx on editais (fonte);

drop function if exists buscar_editais(text, text[], text[], int[], numeric, numeric, boolean, text, boolean, timestamptz, text, int, int);

-- Avisos de diário sem data de propostas identificada contam como abertos por 20 dias após a publicação.
create or replace function buscar_editais(
  p_q text default null, p_areas text[] default null, p_ufs text[] default null, p_modalidades int[] default null,
  p_valor_min numeric default null, p_valor_max numeric default null, p_abertas boolean default true,
  p_excluir text default null, p_qualquer boolean default false, p_desde timestamptz default null,
  p_ordem text default 'encerramento', p_limite int default 30, p_offset int default 0, p_fontes text[] default null
) returns table (
  id text, fonte text, orgao_cnpj text, ano int, sequencial int, orgao_nome text, uf text, municipio text, modalidade text,
  objeto text, valor_estimado numeric, situacao_id int, situacao text, publicado_em timestamptz,
  encerramento_em timestamptz, areas text[], srp boolean, total bigint
) language sql stable security invoker set search_path = public as $$
  with alvo as (
    select e.* from editais e
    where (p_ufs is null or e.uf = any(p_ufs))
      and (p_fontes is null or e.fonte = any(p_fontes))
      and (p_modalidades is null or e.modalidade_id = any(p_modalidades))
      and (p_valor_min is null or e.valor_estimado >= p_valor_min)
      and (p_valor_max is null or e.valor_estimado <= p_valor_max)
      and (not p_abertas
           or (e.encerramento_em >= now() and coalesce(e.situacao_id, 1) in (1, 4))
           or (e.encerramento_em is null and e.fonte <> 'pncp' and e.publicado_em >= now() - interval '20 days'))
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
  select a.id, a.fonte, a.orgao_cnpj, a.ano, a.sequencial, a.orgao_nome, a.uf, a.municipio, a.modalidade, a.objeto,
         a.valor_estimado, a.situacao_id, a.situacao, a.publicado_em, a.encerramento_em, a.areas, a.srp,
         count(*) over () as total
  from alvo a
  order by
    case when p_ordem = 'encerramento' then coalesce(a.encerramento_em, a.publicado_em + interval '20 days') end asc nulls last,
    case when p_ordem = 'recentes' then a.publicado_em end desc nulls last,
    case when p_ordem = 'valor' then a.valor_estimado end desc nulls last,
    a.id
  limit least(greatest(p_limite, 1), 100) offset greatest(p_offset, 0);
$$;
