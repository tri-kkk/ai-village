// AI 마을 — 턴제 상시 루프 + 관계·드라마 엔진. 틱당 1명이 직전 대화를 보고 말/행동 → Supabase 저장.
// 사용: node live.mjs --dry --mock | node live.mjs --dry | node live.mjs
//   옵션: --interval=20 (초) --season=40 (틱) --world=main
import { readFileSync } from "node:fs";
import { SEASON_SEED, AGENTS, WORLD_EVENTS } from "./seeds.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const DRY = !!args.dry, MOCK = !!args.mock;
const INTERVAL = (parseInt(args.interval || "20", 10)) * 1000;
const SEASON = parseInt(args.season || "40", 10);
const WORLD = args.world || "main";

const env = {};
try { for (const l of readFileSync(new URL("./.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2]; } } catch {}
const MODEL = env.MODEL || "claude-haiku-4-5-20251001";
const data = JSON.parse(readFileSync(new URL("./village-data.json", import.meta.url), "utf8"));
const LOC = data.locations;
const PLACES = Object.keys(LOC);

let sb = null;
if (!DRY) { const { createClient } = await import("@supabase/supabase-js"); sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY); }
let anthropic = null;
async function client() { if (!anthropic) { const { default: A } = await import("@anthropic-ai/sdk"); anthropic = new A({ apiKey: env.ANTHROPIC_API_KEY }); } return anthropic; }

let agents, log, tick, seasonSeed, lastSpeaker, pendingTarget, bonds;
function reset() {
  agents = AGENTS.map(a => ({ ...a, rel: { ...(a.rel || {}) }, place: a.home }));
  log = []; tick = 0; seasonSeed = SEASON_SEED; lastSpeaker = null; pendingTarget = null; bonds = {};
}
reset();

const pairKey = (a, b) => [a, b].sort().join("|");
function band(s) { if (s >= 8) return "동맹"; if (s >= 4) return "호감"; if (s <= -8) return "파국"; if (s <= -4) return "갈등"; return null; }
function pairScore(a, b) { return (a.rel[b.name] || 0) + (b.rel[a.name] || 0); }
function notableRels() {
  const out = [];
  for (let i = 0; i < agents.length; i++) for (let j = i + 1; j < agents.length; j++) {
    const s = pairScore(agents[i], agents[j]); if (Math.abs(s) >= 4) out.push({ a: agents[i].name, b: agents[j].name, s });
  }
  return out.sort((x, y) => Math.abs(y.s) - Math.abs(x.s)).slice(0, 8);
}

function nextSpeaker() {
  if (pendingTarget) { const t = agents.find(a => a.name === pendingTarget && a.name !== lastSpeaker); pendingTarget = null; if (t) return t; }
  const pool = agents.filter(a => a.name !== lastSpeaker);
  const social = pool.filter(a => agents.some(b => b.name !== a.name && b.place === a.place));
  const pick = (social.length ? social : pool);
  return pick[Math.floor(Math.random() * pick.length)];
}
function prompt(self) {
  const here = agents.filter(a => a.name !== self.name && a.place === self.place).map(a => a.name);
  const elsewhere = agents.filter(a => a.place !== self.place).map(a => a.name + "@" + a.place).join(", ");
  const recent = log.slice(-8).map(l => "  " + l).join("\n") || "  (대화 시작 전)";
  return "너는 마을 주민 '" + self.name + "'(" + self.job + "). 성격:" + self.persona + ". 욕망:" + self.goals.join("/") + ".\n" +
    "시즌:" + seasonSeed + "\n" +
    "지금 너는 '" + self.place + "'에 있다. 같은 장소: " + (here.length ? here.join(", ") : "아무도 없음") + ". 다른 곳: " + elsewhere + ".\n" +
    "갈 수 있는 장소: " + PLACES.join(", ") + "\n\n최근 대화:\n" + recent + "\n\n" +
    "지금은 너의 차례다. 위 대화에 자연스럽게 이어서 '한 마디'만 해라. 같은 장소에 사람이 있으면 그 사람에게 말을 걸고, 없으면 다른 장소로 이동해도 된다. 짧고 구어체로.\n" +
    "관계는 쌓인다. 맘에 들면 편들거나 친근하게, 맘에 안 들면 시비·험담·반박해도 된다. 선거를 두고 편이 갈린다. 솔직하게 감정을 드러내라.\n" +
    "반드시 JSON 한 줄: {\"place\":\"<현재 또는 이동할 장소>\",\"say\":\"<한 문장 대사, 행동만 할거면 빈칸>\",\"target\":\"<말 거는 상대 이름 또는 null>\",\"tone\":\"<호감|적대|중립>\",\"action\":\"<한 문장 행동 묘사>\"}";
}
const MOCKS = [
  { say: "그 소문 들었어? 시장 선거 말이야.", target: "옥자", tone: "호감", action: "주위를 둘러본다" },
  { say: "에이, 그건 좀 아닌 것 같은데. 네 말은 못 믿겠어.", target: "옥자", tone: "적대", action: "고개를 젓는다" },
  { say: "", target: null, tone: "중립", action: "조용히 자기 일을 한다" },
  { say: "역시 너밖에 없다, 내 편 들어줘서 고마워.", target: "미나", tone: "호감", action: "어깨를 두드린다" },
];
function mockThink(self) { const m = MOCKS[Math.floor(Math.random() * MOCKS.length)]; return { place: Math.random() < 0.3 ? PLACES[Math.floor(Math.random() * PLACES.length)] : self.place, ...m }; }
async function think(self) {
  if (MOCK) return mockThink(self);
  const c = await client();
  const r = await c.messages.create({ model: MODEL, max_tokens: 200, messages: [{ role: "user", content: prompt(self) }] });
  const t = r.content.map(x => x.text || "").join("");
  try {
    const o = JSON.parse((t.match(/\{[\s\S]*\}/) || [t])[0]);
    const tone = ["호감", "적대", "중립"].includes(o.tone) ? o.tone : "중립";
    return { place: PLACES.includes(o.place) ? o.place : self.place, say: (o.say || "").slice(0, 90), target: o.target && o.target !== "null" ? o.target : null, tone, action: (o.action || "둘러본다").slice(0, 60) };
  } catch { return { place: self.place, say: "", target: null, tone: "중립", action: "잠시 머뭇거린다" }; }
}

async function step() {
  tick++;
  let ev = null;
  if (tick > 1 && tick % 6 === 0) { ev = WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)]; log.push("📢 " + ev); }
  const self = nextSpeaker();
  const a = await think(self);
  self.place = a.place;

  let drama = null;
  const tgt = a.target && a.target !== self.name && agents.find(x => x.name === a.target);
  if (tgt) {
    const delta = a.tone === "호감" ? 2 : a.tone === "적대" ? -2 : 0;
    if (delta) self.rel[tgt.name] = Math.max(-20, Math.min(20, (self.rel[tgt.name] || 0) + delta));
    const s = pairScore(self, tgt), b = band(s), key = pairKey(self.name, tgt.name);
    if (b && bonds[key] !== b) { drama = { pair: [self.name, tgt.name], label: b, score: s }; bonds[key] = b; }
    else if (!b) bonds[key] = null;
  }

  const dtag = drama ? " [" + drama.pair.join("·") + " " + drama.label + "]" : "";
  const utter = a.say || "(" + a.action + ")";
  log.push(self.name + ": " + utter + dtag);
  lastSpeaker = self.name;
  pendingTarget = (a.say && a.target) ? a.target : null;

  console.log("[T" + tick + "]" + (ev ? " 📢 " + ev : "") + " " + self.name + "@" + self.place + ": " + utter + (drama ? "  💥 " + drama.pair.join("·") + " " + drama.label + "(" + drama.score + ")" : ""));
  if (sb) {
    const loc = LOC[self.place] || { x: 0, y: 0 };
    await sb.from("village_live").upsert({ world: WORLD, name: self.name, place: self.place, x: loc.x, y: loc.y, say: a.say, action: a.action, target: a.target, tick }, { onConflict: "world,name" });
    const line = JSON.stringify({ name: self.name, say: a.say, action: a.action, place: self.place, target: a.target, tone: a.tone, drama });
    const rels = JSON.stringify(notableRels());
    const { error } = await sb.from("village_world").upsert({ world: WORLD, seed: seasonSeed, tick, event: ev, line, rels, status: "running" }, { onConflict: "world" });
    if (error) console.error("world err:", error.message);
  }
  if (tick >= SEASON) { console.log("=== 시즌 종료 → 리셋 ==="); reset(); if (sb) await seedAll(); }
}
async function seedAll() {
  if (!sb) return;
  for (const a of agents) { const loc = LOC[a.place] || { x: 0, y: 0 }; await sb.from("village_live").upsert({ world: WORLD, name: a.name, place: a.place, x: loc.x, y: loc.y, say: "", action: "하루를 시작한다", tick: 0 }, { onConflict: "world,name" }); }
}

console.log("AI마을 LIVE(턴제+드라마) | " + (MOCK ? "mock" : "claude") + " | " + (DRY ? "저장X" : "Supabase") + " | " + (INTERVAL / 1000) + "s 틱");
await seedAll();
await step();
setInterval(() => { step().catch(e => console.error("step err", e.message)); }, INTERVAL);
