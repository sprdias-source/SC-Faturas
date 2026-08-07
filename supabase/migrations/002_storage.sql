-- Confere — storage para os arquivos originais (PDF/OFX) das importações
-- Cole este arquivo no SQL Editor do seu projeto Supabase e rode (depois
-- do 001_initial_schema.sql).

alter table imports add column if not exists storage_path text;

insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;

-- Caminho do arquivo é sempre "<household_id>/...", então dá pra checar
-- que quem lê/escreve é membro daquele household só olhando a primeira
-- pasta do caminho.
create policy "membro lê arquivos do seu household" on storage.objects
  for select using (bucket_id = 'imports' and is_household_member((storage.foldername(name))[1]::uuid));

create policy "membro sobe arquivo pro seu household" on storage.objects
  for insert with check (bucket_id = 'imports' and is_household_member((storage.foldername(name))[1]::uuid));

create policy "membro apaga arquivo do seu household" on storage.objects
  for delete using (bucket_id = 'imports' and is_household_member((storage.foldername(name))[1]::uuid));
