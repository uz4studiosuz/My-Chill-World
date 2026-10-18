import { t } from '../i18n/i18n';
export interface Series { label: string; color: string; values: number[] }

/** Small line chart on a 2D canvas (DPR aware, sized from CSS). */
export function drawChart(canvas: HTMLCanvasElement, series: Series[], format: (n: number) => string = (n) => `${Math.round(n)}`) {
  const dpr = Math.min(devicePixelRatio, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
  if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const pad = { l: 44, r: 10, t: 10, b: 18 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const all = series.flatMap((s) => s.values);
  const theme = getComputedStyle(canvas);
  const muted = theme.getPropertyValue('--muted').trim() || '#a2afa1';
  const line = theme.getPropertyValue('--line').trim() || '#3a463c';
  ctx.font = '11px system-ui, sans-serif';
  if (all.length < 2) {
    ctx.fillStyle = muted;
    ctx.textAlign = 'center';
    ctx.fillText(t('Collecting data…'), w / 2, h / 2);
    return;
  }
  let min = Math.min(...all), max = Math.max(...all);
  if (min > 0 && min < max * 0.5) min = 0;
  if (max === min) { max += 1; min = Math.max(0, min - 1); }
  const span = max - min;
  const isAllNonNegative = all.every((v) => v >= 0);
  min = isAllNonNegative ? Math.max(0, min - span * 0.05) : (min - span * 0.05);
  max += span * 0.08;

  // grid + labels
  ctx.strokeStyle = line;
  ctx.fillStyle = muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 3; i++) {
    const v = min + ((max - min) * i) / 3;
    const y = pad.t + ph - (ph * i) / 3;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + pw, y);
    ctx.stroke();
    ctx.fillText(format(v), pad.l - 6, y);
  }

  for (const s of series) {
    const n = s.values.length;
    if (n < 2) continue;
    const px = (i: number) => pad.l + (pw * i) / (n - 1);
    const py = (v: number) => pad.t + ph - ((v - min) / (max - min)) * ph;
    const fill = s.color + '12';
    ctx.beginPath();
    ctx.moveTo(px(0), py(s.values[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(px(i), py(s.values[i]));
    ctx.lineTo(px(n - 1), pad.t + ph);
    ctx.lineTo(px(0), pad.t + ph);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px(0), py(s.values[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(px(i), py(s.values[i]));
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px(n - 1), py(s.values[n - 1]), 3, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
  }
}
