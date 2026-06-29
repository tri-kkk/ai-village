'use client';
// Next.js용 마을 렌더러 컴포넌트.
// 1) engine.js 를 같은 폴더에 두기 (export class Village)
// 2) assets/tiles.png, objects.png, characters.png, village-data.json 을
//    public/village/ 아래에 복사 (예: public/village/assets/tiles.png)
// 3) <VillageCanvas /> 사용. data 를 직접 넘기면 Supabase 등에서 받아온 프레임으로 교체 가능.
import { useEffect, useRef } from 'react';
import { Village } from './engine';

const BASE = '/village';                 // public/village
const ASSETS = ['tiles', 'objects', 'characters'];

export default function VillageCanvas({ data: dataProp, intervalMs = 4000 }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    let village, raf;
    let cancelled = false;

    async function init() {
      const data = dataProp || (await fetch(`${BASE}/village-data.json`).then((r) => r.json()));
      const imgs = {};
      await Promise.all(
        ASSETS.map(
          (k) =>
            new Promise((res) => {
              const im = new Image();
              im.onload = () => { imgs[k] = im; res(); };
              im.src = `${BASE}/assets/${k}.png`;
            })
        )
      );
      if (cancelled) return;

      village = new Village(canvasRef.current, data, imgs, {
        onFrame: (f, i, total) => {
          const tick = wrapRef.current?.querySelector('[data-tick]');
          if (tick) tick.textContent = i === 0 ? '아침이 밝았다' : `TICK ${i} · 리셋까지 ${total - 1 - i}틱`;
          const feed = wrapRef.current?.querySelector('[data-feed]');
          if (feed)
            feed.innerHTML = f.agents
              .filter((a) => a.say || a.action)
              .map((a) => `<div><b>${a.name}</b> ${a.action}${a.say ? ` — "${a.say}"` : ''}</div>`)
              .join('');
        },
      });
      village.start(intervalMs);
    }
    init();

    return () => {
      cancelled = true;
      if (village?._timer) clearInterval(village._timer);
      cancelAnimationFrame(raf);
    };
  }, [dataProp, intervalMs]);

  return (
    <div ref={wrapRef} style={{ maxWidth: 760, margin: '0 auto' }}>
      <div data-tick style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 8 }}>시작</div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 'auto', imageRendering: 'pixelated', borderRadius: 12, background: '#0f1319' }}
      />
      <div data-feed style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7 }} />
    </div>
  );
}
