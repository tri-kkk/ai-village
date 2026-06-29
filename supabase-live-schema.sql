-- AI 마을 라이브용 테이블. Supabase SQL Editor 에 붙여넣고 Run.
-- (village_ 접두사로 기존 trendsoccer 데이터와 격리)

-- 에이전트 현재 상태 (월드+이름 당 한 행, 매 틱 upsert)
create table if not exists village_live (
  world   text not null,
  name    text not null,
  place   text,            -- 현재 장소 이름 (빵집/광장/...)
  x       int,             -- 도시 타일 좌표
  y       int,
  dir     int default 0,
  say     text,
  action  text,
  target  text,
  tick    int default 0,
  updated timestamptz default now(),
  primary key (world, name)
);

-- 월드 메타 (시즌/틱/현재 이벤트 + 이번 틱 발화 한 줄)
create table if not exists village_world (
  world   text primary key,
  seed    text,
  tick    int default 0,
  event   text,
  line    text,          -- 이번 틱에 말한 1명의 JSON {name,say,action,place,target,tone,drama}
  rels    text,          -- 주목할 관계 JSON [{a,b,s}]
  status  text default 'running',
  started timestamptz default now()
);
-- 기존 테이블에 컬럼 없으면 추가
alter table village_world add column if not exists line text;
alter table village_world add column if not exists rels text;

-- 마피아 게임용 컬럼
alter table village_world add column if not exists phase text;
alter table village_world add column if not exists day int default 0;
alter table village_world add column if not exists roles text;


-- 공개 읽기 허용 (페이지는 anon 키로 읽음). 쓰기는 service_role 키가 RLS 우회.
alter table village_live  enable row level security;
alter table village_world enable row level security;
drop policy if exists "public read live"  on village_live;
drop policy if exists "public read world" on village_world;
create policy "public read live"  on village_live  for select using (true);
create policy "public read world" on village_world for select using (true);

-- 실시간 구독을 쓰려면(선택): 아래로 publication 에 추가
-- alter publication supabase_realtime add table village_live, village_world;
