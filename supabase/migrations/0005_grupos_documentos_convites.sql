-- Grupos de empresas, dados de cadastro, cofre de documentos e convites por link

alter table clientes add column if not exists grupo text;               -- cliente "dono" das empresas (ex.: Marcio Martins Gonçalves)
alter table clientes add column if not exists telefone text;
alter table clientes add column if not exists email text;
alter table clientes add column if not exists endereco text;
alter table clientes add column if not exists responsavel text;
alter table clientes add column if not exists pasta text;               -- pasta do cliente no OneDrive do escritório
alter table clientes add column if not exists cadastro_completo boolean not null default false;
create index if not exists clientes_grupo_idx on clientes (grupo);
alter table perfis add column if not exists telefone text;

alter table documentos add column if not exists tipo text;              -- ex.: CND Federal, Balanço 2024
alter table documentos add column if not exists tamanho bigint;
create index if not exists documentos_cliente_idx on documentos (cliente_id, categoria);
create policy cli_doc_edita on documentos for update using (acessa_cliente(cliente_id)) with check (acessa_cliente(cliente_id));
create policy cli_doc_apaga on documentos for delete using (acessa_cliente(cliente_id));
create policy docs_apaga on storage.objects for delete using (
  bucket_id = 'documentos' and acessa_cliente(((storage.foldername(name))[1])::uuid));

-- Convite: link único que o escritório envia; o cliente completa o cadastro e cria a senha
create table if not exists convites (
  token       text primary key,
  cliente_ids uuid[] not null,
  nome        text,
  email       text,
  criado_por  uuid references perfis(id) default auth.uid(),
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null default now() + interval '30 days',
  usado_em    timestamptz,
  usado_por   uuid references perfis(id)
);
alter table convites enable row level security;
create policy convites_equipe on convites for all using (eh_equipe()) with check (eh_equipe());
