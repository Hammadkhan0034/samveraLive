-- Stories and Story Items schema

create table if not exists public.stories (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  class_id uuid null,
  author_id uuid null,
  title text null,
  caption text null,
  is_public boolean not null default false,
  expires_at timestamp with time zone not null,
  deleted_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint stories_pkey primary key (id),
  constraint stories_author_id_fkey foreign key (author_id) references users (id) on update cascade on delete set null,
  constraint stories_class_id_fkey foreign key (class_id) references classes (id) on update cascade on delete cascade,
  constraint stories_org_id_fkey foreign key (org_id) references orgs (id) on update cascade on delete cascade
) tablespace pg_default;

create index if not exists idx_stories_org_id on public.stories using btree (org_id) tablespace pg_default;
create index if not exists idx_stories_org_class_expires on public.stories using btree (org_id, class_id, expires_at) tablespace pg_default;
create index if not exists idx_stories_class_public on public.stories using btree (class_id, is_public, created_at desc) tablespace pg_default where (is_public = true);
create index if not exists idx_stories_class_expires on public.stories using btree (class_id, expires_at) tablespace pg_default;
create index if not exists idx_stories_created on public.stories using btree (created_at desc) tablespace pg_default;
create index if not exists idx_stories_active on public.stories using btree (created_at desc) tablespace pg_default where (deleted_at is null);
create index if not exists idx_stories_active_class on public.stories using btree (class_id) tablespace pg_default where (deleted_at is null);
create index if not exists idx_stories_active_public on public.stories using btree (is_public, created_at desc) tablespace pg_default where ((deleted_at is null) and (is_public = true));
create index if not exists idx_stories_active_expires on public.stories using btree (expires_at) tablespace pg_default where (deleted_at is null);
create index if not exists idx_stories_active_created on public.stories using btree (created_at desc) tablespace pg_default where (deleted_at is null);

-- Trigger to auto-update updated_at (requires update_updated_at_column function to exist)
do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_update_timestamp' and tgrelid = 'public.stories'::regclass
  ) then
    create trigger trg_update_timestamp before update on public.stories for each row execute function update_updated_at_column();
  end if;
end $$;

-- Story items
create table if not exists public.story_items (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  story_id uuid not null,
  url text null,
  order_index integer not null default 0,
  duration_ms integer null,
  caption text null,
  mime_type text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint story_items_pkey primary key (id),
  constraint story_items_story_id_order_index_key unique (story_id, order_index),
  constraint story_items_org_id_fkey foreign key (org_id) references orgs (id) on update cascade on delete cascade,
  constraint story_items_story_id_fkey foreign key (story_id) references stories (id) on update cascade on delete cascade
) tablespace pg_default;

create index if not exists idx_story_items_org_id on public.story_items using btree (org_id) tablespace pg_default;
create index if not exists idx_story_items_story_order on public.story_items using btree (story_id, order_index) tablespace pg_default;

-- Trigger for story_items updated_at
do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_update_timestamp' and tgrelid = 'public.story_items'::regclass
  ) then
    create trigger trg_update_timestamp before update on public.story_items for each row execute function update_updated_at_column();
  end if;
end $$;


