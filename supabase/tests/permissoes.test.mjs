import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const db = new PGlite();
// Stubs do ambiente Supabase (auth, storage, papéis)
await db.exec(`
create role authenticated; create role anon;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
`);
await db.exec(fs.readFileSync(process.argv[2], "utf8"));
await db.exec(`grant usage on schema public, auth, storage to authenticated;
grant all on all tables in schema public to authenticated; grant select on all tables in schema storage to authenticated;
grant execute on all functions in schema public, auth to authenticated;`);

const S='00000000-0000-0000-0000-00000000000a', A='00000000-0000-0000-0000-00000000000b', B='00000000-0000-0000-0000-00000000000c';
await db.exec(`
insert into auth.users values ('${S}','socio@x',null),('${A}','a@x','{"nome":"Cliente A"}'),('${B}','b@x',null);
update perfis set papel='socio' where id='${S}';
insert into clientes (id,tipo,nome,documento) values ('11111111-1111-1111-1111-111111111111','PJ','Empresa A','1'),('22222222-2222-2222-2222-222222222222','PJ','Empresa B','2');
insert into cliente_membros values ('11111111-1111-1111-1111-111111111111','${A}'),('22222222-2222-2222-2222-222222222222','${B}');
insert into processos (id,numero_cnj) values ('33333333-3333-3333-3333-333333333333','0001'),('44444444-4444-4444-4444-444444444444','0002'); insert into processo_notas values ('33333333-3333-3333-3333-333333333333','segredo interno');
insert into processo_clientes values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','passivo'),('44444444-4444-4444-4444-444444444444','22222222-2222-2222-2222-222222222222','ativo');
insert into andamentos (processo_id,data,fonte,resumo_simples,visivel_cliente) values ('33333333-3333-3333-3333-333333333333',now(),'DJEN','liberado',true),('33333333-3333-3333-3333-333333333333',now(),'DJEN','oculto',false);
insert into prazos (processo_id,descricao,data_fatal) values ('33333333-3333-3333-3333-333333333333','contestar',current_date);
`);
async function como(uid, sql){ await db.exec(`set role authenticated; select set_config('app.uid','${uid}',false);`); try { const r = await db.query(sql); return r.rows; } catch(e){ return 'ERRO: '+e.message.split('\n')[0]; } finally { await db.exec('reset role'); } }
const chk=(n,ok)=>console.log((ok?'OK   ':'FALHA ')+n);
chk('cliente A vê só a própria empresa', (await como(A,'select nome from clientes')).length===1);
chk('cliente A vê só o próprio processo', (await como(A,'select numero_cnj from processos')).map(r=>r.numero_cnj).join()==='0001');
chk('cliente A vê só andamento liberado', (await como(A,'select resumo_simples from andamentos')).map(r=>r.resumo_simples).join()==='liberado');
chk('cliente A não vê prazos', (await como(A,'select * from prazos')).length===0);
chk('cliente não lê notas internas', (await como(A,'select * from processo_notas')).length===0); chk('sócio lê notas internas', (await como(S,'select * from processo_notas')).length===1);
const ins = await como(A,`insert into chamados (cliente_id,tipo,titulo) values ('22222222-2222-2222-2222-222222222222','consulta','invasão') returning id`);
chk('cliente A não abre chamado para empresa B', typeof ins==='string');
const ok = await como(A,`insert into chamados (cliente_id,tipo,titulo) values ('11111111-1111-1111-1111-111111111111','consulta','ok') returning id`);
chk('cliente A abre chamado para a própria empresa', Array.isArray(ok) && ok.length===1);
const st = await como(A,`insert into chamados (cliente_id,tipo,titulo,status) values ('11111111-1111-1111-1111-111111111111','consulta','x','concluido') returning id`);
chk('cliente não cria chamado já concluído', typeof st==='string');
chk('cliente não se promove a sócio', (await como(A,`update perfis set papel='socio' where id='${A}' returning id`)).length===0);
chk('sócio vê tudo', (await como(S,'select * from processos')).length===2 && (await como(S,'select * from prazos')).length===1);
chk('cliente B não vê intimações/andamentos de A', (await como(B,'select * from andamentos')).length===0);
chk('perfil criado automaticamente como cliente', (await db.query(`select papel from perfis where id='${B}'`)).rows[0].papel==='cliente');
