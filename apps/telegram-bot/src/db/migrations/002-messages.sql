-- Recent conversation per user. The app keeps the last 20 and deletes older ones.
create table messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null
);
