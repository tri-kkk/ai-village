-- AI 마을 테이블 (village_ 접두사로 기존 trendsoccer 데이터와 격리)
-- Supabase SQL Editor에 붙여넣고 실행

create table if not exists village_worlds (
  id uuid primary key default gen_random_uuid(),
  tick int not null default 0,
  status text not null default 'running',   -- running | ended
  seed text,
  started_at timestamptz default now(),
  ends_at timestamptz
);

create table if not exists village_agents (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references village_worlds(id) on delete cascade,
  name text not null,
  job text not null,
  persona text,
  goals jsonb default '[]',
  location jsonb default '{"x":8,"y":5}',
  state text default '쉬는 중',
  relationships jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists village_memories (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references village_agents(id) on delete cascade,
  content text not null,
  importance int default 5,
  tick int default 0,
  created_at timestamptz default now()
);

create table if not exists village_events (
  id uuid primary key default gen_random_uuid(),
  world_id uuid references village_worlds(id) on delete cascade,
  tick int default 0,
  actor_id uuid references village_agents(id) on delete set null,
  target_id uuid references village_agents(id) on delete set null,
  text text not null,
  created_at timestamptz default now()
);

create index if not exists idx_village_events_world_tick on village_events(world_id, tick);
create index if not exists idx_village_memories_agent on village_memories(agent_id, tick);
