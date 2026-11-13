/*
 * @coinsori-strategy v1
 * name: BTC Volume-Confirmed Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Volume-confirmed trend: crypto breakouts that arrive with a volume spike inside a
 * fresh uptrend are more likely to be real moves, not noise. We buy only after a bar
 * CLOSES above the EMA50 while the EMA50 is above the EMA200 (bull regime) and that
 * bar's volume is at least 1.5x its 20-bar average. We sell when a bar closes below
 * the EMA200 (a slower exit, so we ride the trend longer) or a hard 2.5xATR stop is
 * hit. This loses in choppy sideways markets (whipsaws) and underperforms
 * buy-and-hold in a relentless bull run with no pullback.
 */
function onUpdate(ctx) {
  const s = ctx.state;
  const price = ctx.price;

  const ema50 = ctx.ema(50);
  const ema200 = ctx.ema(200);
  const atr = ctx.atr(14);
  if (ema50 == null || ema200 == null || atr == null) return null;

  // roll closed-bar snapshot once per new bar (platform pattern, no ago arg)
  if (s.lastBarI !== ctx.i) {
    s.prevClose = s.close ?? null;
    s.prevEma50 = s.ema50 ?? null;
    s.prevEma200 = s.ema200 ?? null;
    s.lastBarI = ctx.i;
  }
  s.close = price;
  s.ema50 = ema50;
  s.ema200 = ema200;

  // volume spike on CLOSED bars only (volumes array; last element = current forming bar)
  const vols = ctx.volumes;
  if (vols == null || vols.length < 22) return null;
  let sum = 0;
  for (let i = vols.length - 3; i >= vols.length - 22; i--) sum += vols[i];
  const avgVol = sum / 20;
  const volNow = vols[vols.length - 2];

  const inPos = ctx.position > 0;
  const bull = s.prevEma50 != null && s.prevEma200 != null && s.prevEma50 > s.prevEma200;
  const volSpike = volNow > 1.5 * avgVol;
  const closedAbove = s.prevClose != null && s.prevEma50 != null && s.prevClose > s.prevEma50;

  let exitLevel = null, stopLevel = null;
  if (inPos && ctx.entryPx != null) {
    exitLevel = s.prevEma200;
    stopLevel = ctx.entryPx - 2.5 * atr; // hard stop: 2.5 ATR below entry, caps a single loss
  }

  const watch = [
    { side: 'buy', price: s.prevEma50, trigger: 'above', note: 'close>EMA50', conds: [
      { label: 'EMA50>EMA200', ok: bull },
      { label: 'Vol>1.5x avg20', ok: volSpike }
    ]}
  ];
  if (exitLevel != null) watch.push({ side: 'sell', price: exitLevel, trigger: 'below', note: 'EMA200 exit' });
  if (stopLevel != null) watch.push({ side: 'sell', price: stopLevel, trigger: 'below', note: 'ATR stop' });
  ctx.watch(watch);

  if (inPos) {
    if (stopLevel != null && price <= stopLevel) { s.exitBar = ctx.i; return { side: 'sell', qty: ctx.position, reduceOnly: true }; }
    if (s.prevClose != null && s.prevEma200 != null && s.prevClose < s.prevEma200) { s.exitBar = ctx.i; return { side: 'sell', qty: ctx.position, reduceOnly: true }; }
    return null;
  }

  // small cooldown after an exit so we do not immediately re-buy the same dip
  if (s.exitBar != null && ctx.i - s.exitBar < 5) return null;

  if (bull && volSpike && closedAbove) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  }
  return null;
}
