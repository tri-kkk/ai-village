# AI 마을

직업·욕망·기억·관계를 가진 6명의 AI가 작은 도시에서 스스로 살아간다. 사용자는 목적 없이 관찰한다.

## 🔴 라이브 켜기 (3단계) — "진짜 굴러가는 마을"

1. **테이블 만들기**: Supabase 대시보드 → SQL Editor → `supabase-live-schema.sql` 내용 붙여넣고 Run.
   (village_live / village_world 두 테이블 + 공개 읽기 정책. 기존 trendsoccer 데이터와 격리됨.)

2. **틱 루프 돌리기** (터미널):
   ```bash
   cd ai-village
   npm install
   node live.mjs --mock        # 무료 테스트 (Claude 호출 없이 더미로 동작 확인)
   node live.mjs                # 실제 Claude로 주민이 살아 움직이며 매 틱 Supabase 저장 (상시 구동)
   ```
   매 틱마다 6명이 어디로 갈지·뭐라고 할지 Claude가 정하고, 그 상태가 Supabase에 저장돼.

3. **보기**: `live.html` 더블클릭 → Supabase에서 실시간으로 읽어 도시에 주민이 움직인다.
   새로고침할 때마다 마을이 그새 진행돼 있음 = 살아있는 세계. (`live.mjs`가 켜져 있어야 함)

**비용**: `--interval` 초가 작을수록 비쌈. 테스트는 `--mock`(무료). 상시 운영은 `node live.mjs --interval=900`(15분 틱) → Haiku 기준 월 ~$27. 시즌 길이는 `--season=24`(틱).

## 두 갈래

### 시뮬레이션
- `seeds.mjs` 페르소나·욕망·관계, 랜덤 사건 / `live.mjs` 상시 틱 루프(장소 기반 + Supabase 저장)
- `core.mjs`·`tick.mjs`·`dump.mjs` Phase 0 콘솔 검증용(좌표 기반)
- `supabase-live-schema.sql` 라이브 테이블 / `supabase-schema.sql` 구버전 참고

### 렌더러 (도시 타일엔진)
- `engine.js` 순수 타일맵 렌더러(ESM). `data.ground/buildings/props/dashes` 를 그림 + 4방향 캐릭터 + 밤낮 + **라이브 모드**(`applyLive/startRender`)
- `engine.classic.js` 데모용 전역 버전
- `live.html` **라이브 페이지**(Supabase 폴링) / `village2.html` 고정 재생본(데모)
- `assets/tileset.png` Kenney RPG Urban Pack(CC0) 타일시트
- `VillageCanvas.jsx` Next.js 컴포넌트

## 맵(아트)은 데이터다 — Tiled로 폴리시

지금 도시 맵은 코드로 생성한 **플레이스홀더**다. 엔진은 `data.ground[][]`(타일 인덱스 배열) + `buildings/props` 만 읽으므로,
나중에 **Tiled**(무료 타일 에디터)로 `assets/tileset.png` 를 깔고 예쁘게 칠한 맵을 export 해서
같은 형식으로 넣으면 **엔진 수정 없이** 그대로 고품질 맵이 된다. (블라인드 코드 생성보다 이 방식이 샘플급 퀄을 냄)

## 데이터 형식

`village-data.json`:
- `map{w,h}`, `locations{장소:{x,y}}`, `charBase{이름:타일인덱스}`
- `ground[y][x]` = Kenney 타일 인덱스 / `buildings[]`,`props[]`,`dashes[]` = 오버레이
- `frames[]` = 고정 데모용(라이브에선 Supabase가 대체)

## Next.js 연동

`engine.js` 복사 + `assets/tileset.png`·`village-data.json` 을 `public/` 에 두고,
라이브는 서버에서 Supabase를 읽어 `applyLive()` 로 넘기면 끝. (file:// 데모는 데이터를 인라인)

## 다음
- 시즌 종료 시 연대기 자동 생성 → 아카이브 페이지(검색·공유 콘텐츠)
- Tiled로 맵 폴리시 / 건물·차·차양 다양화
- 관계 임계 이벤트(고백·결별·연합), 유저의 가벼운 개입(소문 한 줄)
