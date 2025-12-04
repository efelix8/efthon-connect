-- RLS policies for profiles, users, rooms, messages

-- PROFILES: 1–1 with Cloud Auth user; everyone (authenticated) görebilir,
-- kullanıcı sadece kendi profilini oluşturup güncelleyebilir.

create policy "Profiles are viewable by authenticated users"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- USERS: chat tarafı için nickname bilgisi herkese (authenticated) okunabilir,
-- kullanıcı sadece kendi satırını oluşturup güncelleyebilir.

create policy "Users are viewable by authenticated users"
  on public.users
  for select
  to authenticated
  using (true);

create policy "Users can insert their own user row"
  on public.users
  for insert
  to authenticated
  with check (auth_user_id = auth.uid());

create policy "Users can update their own user row"
  on public.users
  for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());


-- ROOMS: yalnızca okunabilir; normal kullanıcı oda ekleyemez/silemez.

create policy "Rooms are viewable by authenticated users"
  on public.rooms
  for select
  to authenticated
  using (true);


-- MESSAGES: herkes (authenticated) mesajları görebilir (soft delete hariç),
-- kullanıcı yalnızca kendisine ait user satırı üzerinden mesaj yazabilir/güncelleyebilir.

create policy "Messages are viewable by authenticated users"
  on public.messages
  for select
  to authenticated
  using (deleted_at is null);

create policy "Users can insert their own messages"
  on public.messages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.users u
      where u.id = public.messages.user_id
        and u.auth_user_id = auth.uid()
    )
  );

create policy "Users can update their own messages"
  on public.messages
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = public.messages.user_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.users u
      where u.id = public.messages.user_id
        and u.auth_user_id = auth.uid()
    )
  );