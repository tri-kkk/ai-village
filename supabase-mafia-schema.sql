-- AI 마을 마피아 게임: 확장 스키마
-- events: 모든 비트 기록 (append-only)
-- seasons: 게임 메타 및 결과
-- village_world: 기존 + game_type/game_no 추가

-- events 테이블: 게임의 모든 비트를 누적 기록
create table if not exists village_events (
  id          bigserial primary key,
  world       text not null,
  game_no     int not null,
  tick        int not null,              -- 누적 틱 (게임 통틀어)
  phase       text,                      -- 밤/낮/투표/종료/준비
  day         int default 0,             -- N일차
  beat_type   text,                      -- setup/mafia/doctor/cop/discuss/vote/execute/resolve/end
  speaker     text,                      -- 발화자 이름 또는 null
  line        jsonb,                     -- {name, role, say, action, secret, tone, drama}
  roles       jsonb,                     -- 현재 역할 스냅샷: [{name, role, alive}]
  event       text,                      -- 시스템 이벤트 메시지
  drama       jsonb,                     -- {pair, label, kind} 또는 null
  created_at  timestamptz default now()
);
create index if not exists idx_village_events_world_game on village_events(world, game_no);
create index if not exists idx_village_events_world_tick on village_events(world, tick);

-- seasons 테이블: 게임 메타 및 최종 결과
create table if not exists village_seasons (
  world       text not null,
  game_no     int not null,
  game_type   text,                      -- "마피아" / (나중) "연애리얼리티" 등
  started_at  timestamptz default now(),
  ended_at    timestamptz,               -- 게임 종료 시간
  winner      text,                      -- "시민" / "마피아" / "동맹" 등
  final_roles jsonb,                     -- 최종 공개 역할
  stats       jsonb,                     -- {total_ticks, total_days, kills, votes, ...}
  archive     text,                      -- 시즌 연대기 텍스트 (나중 자동생성)
  primary key (world, game_no)
);

-- village_world 수정: 기존 컬럼 유지, 게임 메타 추가
alter table village_world add column if not exists game_type text;
alter table village_world add column if not exists game_no int default 1;

-- 공개 읽기 허용
alter table village_events enable row level security;
alter table village_seasons enable row level security;
drop policy if exists "public read events" on village_events;
drop policy if exists "public read seasons" on village_seasons;
create policy "public read events" on village_events for select using (true);
create policy "public read seasons" on village_seasons for select using (true);
