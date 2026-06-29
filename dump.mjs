// 시뮬레이션을 돌려 틱별 프레임(위치·대사)을 village-data.json 으로 덤프
// 사용: node dump.mjs --ticks=4 --live   (또는 --mock)
import { writeFileSync } from "node:fs";
import {
  agents, events, liveThink, mockThink, MODE, MAP, WORLD_EVENTS,
  clampN, isAgent, SEASON_SEED, LOCATIONS, getClient, MODEL,
} from "./core.mjs";

const N = parseInt((process.argv.find((a) => a.startsWith("--ticks=")) || "--ticks=4").split("=")[1], 10);
const frames = [];
frames.push({ tick: 0, event: null, agents: agents.map((a) => ({ name: a.name, job: a.job, x: a.location.x, y: a.location.y, say: "", action: a.state, target: null })) });

for (let t = 1; t <= N; t++) {
  let ev = null;
  if (t > 1 && t % 3 === 0) {
    ev = WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)];
    events.push({ tick: t, actor: "마을", target: null, text: "📢 " + ev });
    for (const a of agents) a.memories.push({ content: "📢 " + ev, importance: 8, tick: t });
  }
  const acts = [];
  for (const self of agents) {
    const a = MODE === "live" ? await liveThink(self) : mockThink();
    self.location = { x: clampN(a.move_to.x | 0, 0, MAP.w - 1), y: clampN(a.move_to.y | 0, 0, MAP.h - 1) };
    self.state = a.action;
    if (a.target && isAgent(a.target) && a.feeling) self.rel[a.target] = clampN((self.rel[a.target] || 0) + a.feeling * 5, -100, 100);
    events.push({ tick: t, actor: self.name, target: a.target, text: `[${self.name}] ${a.action}${a.say ? ` — "${a.say}"` : ""}${a.target ? ` (→${a.target})` : ""}` });
    self.memories.push({ content: `[${self.name}] ${a.action}`, importance: a.target ? 7 : 4, tick: t });
    acts.push({ name: self.name, job: self.job, x: self.location.x, y: self.location.y, say: a.say || "", action: a.action, target: a.target });
  }
  frames.push({ tick: t, event: ev, agents: acts });
  console.log("tick " + t + " done");
}

let chronicle = "";
if (MODE === "live") {
  const log = events.map((e) => `T${e.tick} ${e.text}`).join("\n");
  const c = await getClient();
  const r = await c.messages.create({
    model: MODEL, max_tokens: 600,
    system: [{ type: "text", text: "너는 마을 사관이다. 사건 기록으로 이번 시즌을 짧고 흥미진진한 연대기로 정리한다." }],
    messages: [{ role: "user", content: `시즌:${SEASON_SEED}\n[사건]\n${log}\n\n형식:\n## 이번 시즌 이야기\n(4문장)\n## 화제의 인물\n(1명+이유)\n## 사건 TOP3\n(3줄)` }],
  });
  chronicle = r.content.map((x) => x.text || "").join("");
}

writeFileSync(new URL("./village-data.json", import.meta.url), JSON.stringify({ seed: SEASON_SEED, map: MAP, locations: LOCATIONS, frames, chronicle }));
console.log("wrote village-data.json (frames=" + frames.length + ")");
