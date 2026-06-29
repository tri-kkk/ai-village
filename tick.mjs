// AI 마을 Phase 0 진입점. 사용: node tick.mjs --ticks=8 --live [--store=supabase] | --mock
import {
  TICKS, MODE, STORE, MODEL, PRICE, usage, clampN, sign,
  world, agents, events, isAgent, getClient, track, liveThink, mockThink,
  SEASON_SEED, MAP, WORLD_EVENTS,
} from "./core.mjs";

async function runTick(t) {
  world.tick = t;
  console.log(`\n──── TICK ${t} ────`);
  if (t > 1 && t % 3 === 0) {
    const text = "📢 " + WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)];
    events.push({ tick: t, actor: "마을", target: null, text });
    for (const a of agents) a.memories.push({ content: text, importance: 8, tick: t });
    console.log("  " + text);
  }
  for (const self of agents) {
    const a = MODE === "live" ? await liveThink(self) : mockThink();
    self.location = { x: clampN(a.move_to.x | 0, 0, MAP.w - 1), y: clampN(a.move_to.y | 0, 0, MAP.h - 1) };
    self.state = a.action;
    if (a.target && isAgent(a.target) && a.feeling) self.rel[a.target] = clampN((self.rel[a.target] || 0) + a.feeling * 5, -100, 100);
    const chip = a.target && a.feeling ? ` [${a.target} ${sign(a.feeling)}${a.feeling}]` : "";
    const line = `[${self.name}] ${a.action}${a.say ? ` — "${a.say}"` : ""}${a.target ? ` (→${a.target})` : ""}`;
    console.log("  " + line + chip);
    events.push({ tick: t, actor: self.name, target: a.target, text: line });
    self.memories.push({ content: line, importance: a.target ? 7 : 4, tick: t });
  }
  if (t % 5 === 0) for (const s of agents) {
    s.summary = s.memories.slice(-8).map((m) => m.content).join(" / ").slice(0, 240);
    s.memories = s.memories.slice(-3);
  }
}

async function chronicle() {
  console.log(`\n════ 📜 마을 연대기 ════`);
  if (MODE !== "live") { console.log("(연대기는 --live 에서 생성)"); return; }
  const log = events.map((e) => `T${e.tick} ${e.text}`).join("\n");
  const rel = agents.map((a) => `${a.name}: ${Object.entries(a.rel).map(([k, v]) => k + sign(v) + v).join(", ") || "-"}`).join("\n");
  const c = await getClient();
  const r = await c.messages.create({
    model: MODEL, max_tokens: 600,
    system: [{ type: "text", text: "너는 마을 사관이다. 사건 기록으로 이번 시즌을 짧고 흥미진진한 연대기로 정리한다." }],
    messages: [{ role: "user", content: `시즌: ${SEASON_SEED}\n[사건]\n${log}\n[종료시점 관계]\n${rel}\n\n형식:\n## 이번 시즌 이야기\n(4~6문장)\n## 화제의 인물\n(1명+이유)\n## 사건 TOP3\n(3줄)` }],
  });
  track(r.usage);
  console.log("\n" + r.content.map((x) => x.text || "").join(""));
}

async function persist() {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: w } = await sb.from("village_worlds").insert({ tick: world.tick, seed: world.seed }).select().single();
  await sb.from("village_agents").insert(agents.map((a) => ({ world_id: w.id, name: a.name, job: a.job, persona: a.persona, goals: a.goals, location: a.location, state: a.state, relationships: a.rel })));
  await sb.from("village_events").insert(events.map((e) => ({ world_id: w.id, tick: e.tick, text: e.text })));
  console.log(`\n💾 Supabase 저장 (world ${w.id})`);
}

function report() {
  const cost = (usage.in * PRICE.in + usage.out * PRICE.out + usage.cw * PRICE.cw + usage.cr * PRICE.cr) / 1e6;
  const day = (cost / TICKS) * 96;
  console.log(`\n════ 비용 (${MODE}) ════`);
  console.log(`호출 ${usage.calls} / 입력 ${usage.in} 출력 ${usage.out} 캐시쓰기 ${usage.cw} 캐시읽기 ${usage.cr}`);
  console.log(`이번 ${TICKS}틱: $${cost.toFixed(4)} (틱당 $${(cost / TICKS).toFixed(4)})`);
  console.log(`운영환산 6명·15분틱·24h: 하루 $${day.toFixed(2)} / 월 약 $${(day * 30).toFixed(1)}`);
  if (MODE === "mock") console.log("※ mock 수치는 가짜. 실제는 --live.");
}

(async () => {
  console.log(`AI마을 | ${MODE} | 저장:${STORE} | ${TICKS}틱 | ${MODEL}`);
  console.log("시즌: " + SEASON_SEED);
  for (let t = 1; t <= TICKS; t++) await runTick(t);
  await chronicle();
  if (STORE === "supabase") await persist();
  report();
})().catch((e) => { console.error("에러:", e.message); process.exit(1); });
