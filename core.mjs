// 설정 · 상태 · 사고 로직 (tick.mjs 가 import)
import { readFileSync } from "node:fs";
import { SEASON_SEED, MAP, LOCATIONS, AGENTS, WORLD_EVENTS } from "./seeds.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true];
}));
export const TICKS = parseInt(args.ticks || "4", 10);
export const MODE = args.live ? "live" : "mock";
export const STORE = args.store === "supabase" ? "supabase" : "memory";

try {
  const txt = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}
export const MODEL = process.env.MODEL || "claude-haiku-4-5-20251001";

export const PRICE = { in: 1.0, out: 5.0, cw: 1.25, cr: 0.1 };
export const usage = { in: 0, out: 0, cw: 0, cr: 0, calls: 0 };
export const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const sign = (v) => (v > 0 ? "+" : "");
const label = (v) => (v >= 60 ? "매우친함" : v >= 20 ? "친함" : v <= -60 ? "적대" : v <= -20 ? "껄끄러움" : "보통");

export const world = { tick: 0, seed: SEASON_SEED };
export const events = [];
export const agents = AGENTS.map((a) => ({
  ...a, rel: { ...(a.rel || {}) }, location: { ...LOCATIONS[a.home] },
  state: "하루를 시작한다", memories: [], summary: "",
}));
export { SEASON_SEED, MAP, LOCATIONS, WORLD_EVENTS };
export const isAgent = (n) => agents.some((a) => a.name === n);

const places = Object.entries(LOCATIONS).map(([k, v]) => `${k}(${v.x},${v.y})`).join(", ");
const RULES = `너는 작은 마을 주민을 1인칭으로 연기한다.
[규칙] 맵 ${MAP.w}x${MAP.h} 격자. 장소: ${places}. 시즌: ${SEASON_SEED}
직업/성격/욕망/관계에 따라 행동하고 다른 주민과 가까워지거나 틀어진다. 짧고 구체적으로, 같은 행동 반복 금지.
[아래 JSON 한 줄만 출력, 설명 금지]
{"move_to":{"x":0,"y":0},"action":"행동","say":"대사 또는 빈문자열","target":"상대이름 또는 null","feeling":0}
move_to 0~${MAP.w - 1}, feeling 상대감정변화 -3~3(없으면 0).`;

function nearby(self) {
  return agents.filter((a) => a.name !== self.name).map((a) => ({
    name: a.name, job: a.job, state: a.state,
    d: Math.abs(a.location.x - self.location.x) + Math.abs(a.location.y - self.location.y),
  })).sort((x, y) => x.d - y.d);
}
function prompt(self) {
  const near = nearby(self).slice(0, 3).map((n) => `- ${n.name}(${n.job}) 거리${n.d} "${n.state}"`).join("\n");
  const rp = Object.entries(self.rel).filter(([, v]) => v !== 0).map(([k, v]) => `${k}:${sign(v)}${v}(${label(v)})`);
  const recent = events.slice(-6).map((e) => `- ${e.text}`).join("\n") || "- (조용하다)";
  return `[나] ${self.name}/${self.job}\n성격:${self.persona}\n욕망:${self.goals.join(" / ")}\n위치:(${self.location.x},${self.location.y}) 상태:${self.state}\n기억:${self.summary || "(없음)"}\n[관계] ${rp.length ? rp.join(", ") : "(없음)"}\n[주변]\n${near}\n[최근 사건]\n${recent}\n지금 무엇을 하겠는가? JSON 한 줄로 답하라.`;
}

let client = null;
export async function getClient() {
  if (!client) { const { default: A } = await import("@anthropic-ai/sdk"); client = new A({ apiKey: process.env.ANTHROPIC_API_KEY }); }
  return client;
}
export function track(u = {}) {
  usage.in += u.input_tokens || 0; usage.out += u.output_tokens || 0;
  usage.cw += u.cache_creation_input_tokens || 0; usage.cr += u.cache_read_input_tokens || 0; usage.calls++;
}
function parse(text, self) {
  try {
    const m = text.match(/\{[\s\S]*\}/); const o = JSON.parse(m ? m[0] : text);
    return {
      move_to: o.move_to && typeof o.move_to.x === "number" ? o.move_to : self.location,
      action: String(o.action || "가만히 있는다").slice(0, 120),
      say: o.say ? String(o.say).slice(0, 120) : "",
      target: o.target && o.target !== "null" ? String(o.target) : null,
      feeling: Number.isFinite(o.feeling) ? clampN(o.feeling, -3, 3) : 0,
    };
  } catch { return { move_to: self.location, action: "머뭇거린다", say: "", target: null, feeling: 0 }; }
}
export async function liveThink(self) {
  const c = await getClient();
  const r = await c.messages.create({
    model: MODEL, max_tokens: 300,
    system: [{ type: "text", text: RULES, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt(self) }],
  });
  track(r.usage);
  return parse(r.content.map((x) => x.text || "").join(""), self);
}
const MOCKS = [
  { action: "가게를 쓸며 손님을 기다린다", say: "오늘은 다 팔아야지", t: null, f: 0 },
  { action: "광장으로 가 사람들을 살핀다", say: "", t: null, f: 0 },
  { action: "슬쩍 소문을 흘린다", say: "그 얘기 들었어요?", t: "옥자", f: 1 },
  { action: "못마땅하게 쏘아붙인다", say: "두고 보자고", t: "서연", f: -2 },
  { action: "수줍게 말을 건넨다", say: "저, 저기...", t: "미나", f: 2 },
];
export function mockThink() {
  const p = MOCKS[Math.floor(Math.random() * MOCKS.length)];
  const loc = Object.values(LOCATIONS)[Math.floor(Math.random() * Object.keys(LOCATIONS).length)];
  usage.in += 760; usage.out += 190; usage.calls++;
  return { move_to: { ...loc }, action: p.action, say: p.say, target: p.t, feeling: p.f };
}
