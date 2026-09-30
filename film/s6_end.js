'use strict';
// ─────────────────────────────────────────────────────────────
//  SCENE 6 · THE STORY  (28.3 → 32.5s)
//  the point opens into warm cream — a single editorial statement
// ─────────────────────────────────────────────────────────────
function drawEnd(ctx, t, origin) {
  const k = er(t, T.iris, T.s6 + 0.05, E.io3);
  const R = 2300 * k;
  if (R <= 0) return;
  ctx.save();
  ctx.beginPath(); ctx.arc(origin[0], origin[1], R, 0, TAU); ctx.clip();
  ctx.fillStyle = col(P.cream); ctx.fillRect(0, 0, W, H);
  // paper texture: faint dot grid
  ctx.fillStyle = col(P.em, 0.07);
  for (let y = 24; y < H; y += 48) for (let x = 24; x < W; x += 48) ctx.fillRect(x, y, 1.4, 1.4);

  const ink = P.em, ink2 = P.deep;
  // top micro line
  const m1 = 'PORTUGAL — WALES · CRISTIANO RONALDO';
  const mk = er(t, 29.0, 29.5);
  ctx.font = FONT.mono(13, 500); ctx.textAlign = 'center'; ctx.letterSpacing = '5px';
  ctx.fillStyle = col(ink, 0.75 * mk); ctx.fillText(scramble(m1, mk, 17), CX, 330);
  ctx.letterSpacing = '0px';

  // ATTENTION
  const fA = FONT.sans(900, 196, 'expanded');
  const trackA = lerp(70, -2, er(t, 29.35, 30.5, E.o4));
  const LA = layout(fA, 'ATTENTION', trackA), LAfinal = layout(fA, 'ATTENTION', -2);
  const baseA = 660;
  ctx.save(); ctx.beginPath(); ctx.rect(0, baseA - 190, W, 215); ctx.clip();
  ctx.fillStyle = col(ink2);
  drawGlyphs(ctx, fA, 'ATTENTION', CX, baseA, trackA, 'center', 'fill', (i) => {
    const q = er(t, 29.35 + i * 0.045, 29.95 + i * 0.045, E.o5);
    return { dy: (1 - q) * 210, a: q > 0 ? 1 : 0 };
  });
  ctx.restore();
  const left = CX - LAfinal.width / 2, right = CX + LAfinal.width / 2;

  // serif lines
  const s1 = 'The match is the subject.';
  ctx.save(); ctx.beginPath(); ctx.rect(0, 380, W, 100); ctx.clip();
  ctx.fillStyle = col(ink);
  drawGlyphs(ctx, FONT.serif(66), s1, left + 6, 458, 0, 'left', 'fill', (i) => {
    const q = er(t, 29.1 + i * 0.012, 29.6 + i * 0.012, E.o4); return { dy: (1 - q) * 80, a: q > 0 ? 1 : 0 };
  });
  ctx.restore();
  const s2 = 'is the story';
  ctx.save(); ctx.beginPath(); ctx.rect(0, 690, W, 110); ctx.clip();
  ctx.fillStyle = col(ink);
  drawGlyphs(ctx, FONT.serif(66), s2, right - 90, 762, 0, 'right', 'fill', (i) => {
    const q = er(t, 30.0 + i * 0.02, 30.55 + i * 0.02, E.o4); return { dy: (1 - q) * 80, a: q > 0 ? 1 : 0 };
  });
  ctx.restore();

  // the point — a full stop in acid lime
  const pk = er(t, 31.35, 31.6, E.oB);
  if (pk > 0) {
    const px = right - 90 + 20, py = 751;
    ctx.fillStyle = col(P.lime); ctx.beginPath(); ctx.arc(px, py, 11 * pk, 0, TAU); ctx.fill();
    ctx.strokeStyle = col(ink2, 0.9); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(px, py, 11 * pk, 0, TAU); ctx.stroke();
    const pr = rm(t, 31.45, 32.3);
    if (pr > 0 && pr < 1) ring(ctx, px, py, 11 + 60 * E.o3(pr), ink, 0.5 * (1 - pr), 1);
  }

  // route — the opening line, returned
  const rk = er(t, 30.45, 31.3, E.io3);
  if (rk > 0) {
    const a = [left + 20, 880], b = [right - 20, 880], c = [(a[0] + b[0]) / 2, 800];
    const pts = [];
    for (let i = 0; i <= 80; i++) { const q = quadBez(a, c, b, i / 80 * rk); pts.push({ x: q[0], y: q[1] }); }
    ctx.strokeStyle = col(ink, 0.55); ctx.lineWidth = 1.3; pathPts(ctx, pts, false); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = col(ink, 0.35); ctx.beginPath();
    for (let i = 1; i < 40; i++) { if (i / 40 > rk) break; const q = quadBez(a, c, b, i / 40); ctx.moveTo(q[0], q[1] - (i % 5 ? 3 : 6)); ctx.lineTo(q[0], q[1] + (i % 5 ? 3 : 6)); }
    ctx.stroke();
    dot(ctx, a[0], a[1], 4, ink, 1);
    if (rk > 0.98) dot(ctx, b[0], b[1], 4, ink, 1);
    ctx.font = FONT.mono(11, 500); ctx.letterSpacing = '3px'; ctx.fillStyle = col(ink, 0.7);
    ctx.textAlign = 'left'; ctx.fillText('PT', a[0] - 4, a[1] + 30);
    ctx.textAlign = 'right'; ctx.fillStyle = col(ink, 0.7 * er(t, 31.2, 31.4)); ctx.fillText('WAL', b[0] + 8, b[1] + 30);
    ctx.letterSpacing = '0px';
  }
  // footer (credibility note)
  const fk = er(t, 30.9, 31.4);
  ctx.font = FONT.mono(10); ctx.textAlign = 'center'; ctx.letterSpacing = '3px'; ctx.fillStyle = col(ink, 0.5 * fk);
  ctx.fillText('SEARCH INTEREST SHOWN AS A CONCEPT — NO FIGURES, NOT TO SCALE', CX, 985);
  ctx.letterSpacing = '0px';
  ctx.restore();

  // iris edge
  if (k < 1) ring(ctx, origin[0], origin[1], R, P.lime, 0.9, 2);
}
