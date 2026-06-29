import { readFileSync } from "node:fs";
import { AGENTS, LOCATIONS } from "./seeds.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const DRY = !!args.dry, MOCK = !!args.mock;
const INTERVAL = (parseInt(args.interval || "30", 10)) * 1000;
const WORLD = args.world || "main";
const GAME_TYPE = "마피아";

const env = {};
// Railway 환경 변수 먼저 읽기
env.SUPABASE_URL = process.env.SUPABASE_URL;
env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
env.MODEL = process.env.MODEL;
// 로컬 .env.local에서 읽기 (있으면서 process.env에 없는 것들)
try { for (const l of readFileSync(new URL("./.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !env[m[1]]) env[m[1]] = m[2]; } } catch {}
const MODEL = env.MODEL || "claude-haiku-4-5-20251001";

let sb = null;
if (!DRY) { const { createClient } = await import("@supabase/supabase-js"); sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY); }
let anthropic = null;
async function client() { if (!anthropic) { const { default: A } = await import("@anthropic-ai/sdk"); anthropic = new A({ apiKey: env.ANTHROPIC_API_KEY }); } return anthropic; }

const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[r[i], r[j]] = [r[j], r[i]]; } return r; };
const MAFIA_N = Math.max(1, Math.min(2, parseInt(args.mafia || "1", 10)));
function buildDeck() { const d = []; for (let i = 0; i < MAFIA_N; i++) d.push("마피아"); d.push("의사", "경찰"); while (d.length < AGENTS.length) d.push("시민"); return d; }

let players, day, phase, beats, tick, killName, protName, copKnow, votes, dayLog, gameNo, winner;
function reset() {
  const roles = shuffle(buildDeck());
  players = AGENTS.map((a, i) => ({ name: a.name, job: a.job, persona: a.persona, role: roles[i], alive: true }));
  day = 0; phase = "준비"; beats = [{ type: "setup" }];
  killName = null; protName = null; copKnow = {}; votes = {}; dayLog = []; winner = null;
  gameNo = (gameNo || 0) + 1;
  tick = 0;
  console.log("🔄 RESET: gameNo=", gameNo, "tick=", tick);
}

// DB에서 마지막 game_no 읽어서 초기화
async function initGameNo() {
  if (!sb) {
    gameNo = 0; tick = 0;
    reset();
    return;
  }
  const { data } = await sb.from("village_seasons").select("game_no").order("game_no", { ascending: false }).limit(1);
  const lastGameNo = data && data[0] ? data[0].game_no : 0;
  gameNo = lastGameNo;  // 명시적 설정
  tick = 0;
  reset();  // ← gameNo를 +1
  console.log("🎮 Init from DB: lastGameNo=", lastGameNo, "→ next gameNo=", gameNo);
}

await initGameNo();

const alive = () => players.filter(p => p.alive);
const aliveBy = role => alive().filter(p => p.role === role);
const aliveNames = (ex) => alive().filter(p => p.name !== ex).map(p => p.name);
const find = n => players.find(p => p.name === n);
const rolesSnap = () => players.map(p => ({ name: p.name, role: p.role, alive: p.alive }));

async function askJSON(sys) {
  if (MOCK) return null;
  const c = await client();
  const r = await c.messages.create({ model: MODEL, max_tokens: 160, messages: [{ role: "user", content: sys }] });
  const t = r.content.map(x => x.text || "").join("");
  try { return JSON.parse((t.match(/\{[\s\S]*\}/) || ["{}"])[0]); } catch { return null; }
}
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

async function seedSeason() {
  if (!sb) return;
  const { error } = await sb.from("village_seasons").upsert({ world: WORLD, game_no: gameNo, game_type: GAME_TYPE, started_at: new Date().toISOString() }, { onConflict: "world,game_no" });
  if (error) console.error("season upsert err:", error.message);
}

async function endSeason() {
  if (!sb) return;
  const stats = { total_ticks: tick, total_days: day, mafia_count: MAFIA_N, players: players.length };
  const finalRoles = rolesSnap();
  const { error } = await sb.from("village_seasons").update({ ended_at: new Date().toISOString(), winner, final_roles: JSON.stringify(finalRoles), stats: JSON.stringify(stats) }).eq("world", WORLD).eq("game_no", gameNo);
  if (error) console.error("season end err:", error.message);
}

async function saveBeat(out, b) {
  console.log("[T" + tick + "][" + phase + "]" + (out.event ? " " + out.event : "") + (out.line ? " " + (out.secret ? "(밤) " : "") + out.line.name + ": " + out.line.say : ""));
  if (!sb) { console.error("⚠️  sb null - DB저장 안됨"); return; }
  const roles = rolesSnap();
  const ev = { world: WORLD, game_no: gameNo, tick, phase, day, beat_type: b.type, speaker: out.speaker || null, line: out.line ? JSON.stringify({ ...out.line, secret: !!out.secret }) : null, roles: JSON.stringify(roles), event: out.event || null, drama: out.drama ? JSON.stringify(out.drama) : null };
  const { error: evErr } = await sb.from("village_events").insert(ev);
  if (evErr) console.error("❌ village_events INSERT ERR:", evErr.code, evErr.message);
  else console.log("✅ village_events [T" + tick + "] saved");
  const { error: wErr } = await sb.from("village_world").upsert({ world: WORLD, game_type: GAME_TYPE, game_no: gameNo, tick, phase, day, roles: JSON.stringify(roles), status: winner ? "ended" : "running" }, { onConflict: "world" });
  if (wErr) console.error("❌ village_world UPSERT ERR:", wErr.code, wErr.message);
  else console.log("✅ village_world [T" + tick + "] updated");
}

function nextRound() {
  day++;
  beats.push({ type: "announce", phase: "밤", text: "🌙 " + day + "일차 밤." });
  beats.push({ type: "mafia" });
  if (aliveBy("의사").length) beats.push({ type: "doctor" });
  if (aliveBy("경찰").length) beats.push({ type: "cop" });
  beats.push({ type: "resolve" });
  beats.push({ type: "checkwin" });
  beats.push({ type: "announce", phase: "낮", text: "☀️ " + day + "일차 낮." });
  for (const p of shuffle(alive())) beats.push({ type: "discuss", name: p.name });
  beats.push({ type: "announce", phase: "투표", text: "🗳️ 투표." });
  for (const p of shuffle(alive())) beats.push({ type: "vote", name: p.name });
  beats.push({ type: "execute" });
  beats.push({ type: "checkwin" });
}

async function runBeat(b) {
  if (b.type === "setup") { phase = "준비"; return { event: "🎭 " + gameNo + "번째 판 시작. (마피아 " + MAFIA_N + " · 의사 1 · 경찰 1 · 시민 " + (AGENTS.length - MAFIA_N - 2) + ")" }; }
  if (b.type === "announce") { phase = b.phase; if (b.phase === "투표") votes = {}; return { event: b.text }; }
  if (b.type === "mafia") {
    const maf = aliveBy("마피아"); const decider = maf[0]; const targets = alive().filter(p => p.role !== "마피아").map(p => p.name);
    let o = await askJSON("너는 마피아 '" + decider.name + "'다. 동료: " + maf.map(m => m.name).join(",") + ". 제거: " + targets.join(", ") + '. JSON: {"target":"이름","say":"한 줄"}');
    let tgt = o && targets.includes(o.target) ? o.target : pick(targets);
    killName = tgt;
    return { speaker: decider.name, secret: true, line: { name: decider.name, role: "마피아", say: (o && o.say) || (tgt + "..."), action: "🔪 " + tgt, phase: "밤" } };
  }
  if (b.type === "doctor") {
    const doc = aliveBy("의사")[0]; const targets = aliveNames(null);
    let o = await askJSON("너는 의사 '" + doc.name + "'다. 지킬 사람: " + targets.join(", ") + '. JSON: {"target":"이름"}');
    let tgt = o && targets.includes(o.target) ? o.target : pick(targets);
    protName = tgt;
    return { speaker: doc.name, secret: true, line: { name: doc.name, role: "의사", say: (o && o.say) || (tgt + "를 지킨다"), action: "🛡️ " + tgt, phase: "밤" } };
  }
  if (b.type === "cop") {
    const cop = aliveBy("경찰")[0]; const targets = aliveNames(cop.name).filter(n => !copKnow[n]); const pool = targets.length ? targets : aliveNames(cop.name);
    let o = await askJSON("너는 경찰 '" + cop.name + "'다. 조사: " + pool.join(", ") + '. JSON: {"target":"이름"}');
    let tgt = o && pool.includes(o.target) ? o.target : pick(pool);
    const res = find(tgt).role === "마피아" ? "마피아" : "시민";
    copKnow[tgt] = res;
    return { speaker: cop.name, secret: true, line: { name: cop.name, role: "경찰", say: (o && o.say) || (tgt + " → " + res), action: "🔍 " + tgt + " " + res, phase: "밤" } };
  }
  if (b.type === "resolve") {
    phase = "낮";
    if (killName && killName !== protName) { find(killName).alive = false; const ev = "🔪 " + killName + " 살해."; killName = null; protName = null; return { event: ev, drama: { pair: [ev], label: "암살", kind: "kill" } }; }
    killName = null; protName = null;
    return { event: "평화로운 밤." };
  }
  if (b.type === "discuss") {
    const p = find(b.name); if (!p || !p.alive) return null;
    const dead = players.filter(x => !x.alive).map(x => x.name + "(" + x.role + ")");
    let hint = "추리.";
    if (p.role === "마피아") hint = "정체 숨기기. 동료: " + aliveBy("마피아").filter(m => m.name !== p.name).map(m => m.name).join(",");
    const ctx = dayLog.slice(-4).join("\n  ") || "-";
    let o = await askJSON("게임 " + day + "일차 낮. '" + p.name + "'(" + p.role + "). " + hint + "\n죽은: " + (dead.join(", ") || "없음") + "\n산: " + aliveNames(null).join(", ") + "\n대화:\n  " + ctx + '\nJSON: {"say":"한 줄"}');
    const say = (o && o.say) || "모르겠네.";
    dayLog.push(p.name + ": " + say);
    return { speaker: p.name, line: { name: p.name, role: p.role, say, action: "말한다", phase: "낮" } };
  }
  if (b.type === "vote") {
    const p = find(b.name); if (!p || !p.alive) return null;
    const cands = aliveNames(p.name);
    let o = await askJSON("투표. '" + p.name + "'(역할 " + p.role + "). 후보: " + cands.join(", ") + '. JSON: {"vote":"이름"}');
    const v = o && cands.includes(o.vote) ? o.vote : pick(cands);
    votes[v] = (votes[v] || 0) + 1;
    return { speaker: p.name, line: { name: p.name, role: p.role, say: "", action: "🗳️ " + v, target: v, phase: "투표" } };
  }
  if (b.type === "execute") {
    const entries = Object.entries(votes); if (!entries.length) return { event: "투표 무산." };
    const max = Math.max(...entries.map(e => e[1])); const top = entries.filter(e => e[1] === max).map(e => e[0]);
    const ex = pick(top); const p = find(ex); p.alive = false; dayLog = [];
    return { event: "⚰️ " + ex + " 처형 — [" + p.role + "]", drama: { pair: [ex, p.role], label: p.role === "마피아" ? "마피아 처형" : "무고", kind: p.role === "마피아" ? "good" : "bad" } };
  }
  if (b.type === "checkwin") {
    const maf = aliveBy("마피아").length, town = alive().length - maf;
    if (maf === 0) winner = "시민";
    else if (maf >= town) winner = "마피아";
    if (winner) { phase = "종료"; beats = [{ type: "end" }]; return { event: (winner === "시민" ? "🎉 시민 승리!" : "💀 마피아 승리!"), drama: { pair: [winner + " 승리"], label: "게임 종료", kind: winner === "시민" ? "good" : "bad" } }; }
    return null;
  }
  if (b.type === "end") {
    await endSeason();  // 즉시 호출 (reset() 이전에)
    return { event: "📜 결과: " + players.map(p => p.name + "=" + p.role).join(", ") + " — 새 판 준비…" };
  }
  return null;
}

async function step() {
  if (!beats.length) {
    console.log("⚠️  beats empty. phase=" + phase + " gameNo=" + gameNo + " tick=" + tick);
    if (phase === "종료") {
      console.log("🔴 Before reset: tick=" + tick + " gameNo=" + gameNo);
      reset();
      console.log("🟢 After reset: tick=" + tick + " gameNo=" + gameNo + " beats.length=" + beats.length);
      return;
    }
    nextRound();
  }
  const b = beats.shift(); if (!b) return;
  console.log("📍 beat type=" + b.type + " BEFORE tick++: tick=" + tick);
  tick++;
  console.log("📍 beat type=" + b.type + " AFTER tick++: tick=" + tick);
  const out = await runBeat(b);
  if (out) await saveBeat(out, b);
}

console.log("AI마을 마피아 (기록 저장) | " + (MOCK ? "mock" : "claude") + " | " + (DRY ? "저장X" : "Supabase") + " | " + (INTERVAL / 1000) + "s");
await seedSeason();
await step();
setInterval(() => { step().catch(e => console.error("step err", e.message)); }, INTERVAL);
