/*
 * @coinsori-strategy v1
 * name: BTC 4h Trend Ride + Greed Filter + Stop Cooldown
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The proven trend ride (EMA50>EMA200, F&G<85 euphoria filter,
 * ATR de-risk, -20% hard stop) works, but its worst drawdowns come from a repeated
 * "stop out -> re-enter -> stop out again" cycle in a falling market. Waiting a
 * cooldown after a hard stop keeps the strategy out of the knife-catching re-entry
 * while the trend has not yet genuinely re-established.
 * When it buys: EMA50 above EMA200 (uptrend), Fear & Greed below 85, and not inside a
 * post-stop cooldown.
 * When it sells: trend flips down, hard stop -20% below entry, or de-risk cut at high vol.
 * When it does NOT work: the cooldown can skip a fast V-shaped recovery right after a
 * stop, missing the first leg back up; and in a slow bleed the trend stays broken so
 * the cooldown rarely helps at all.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const atrF = ctx.atr(14, 1);
  const atrS = ctx.atr(100, 1);
  if (atrF == null || atrS == null) return null;
  const e50Prev = ctx.ema(50, 6);
  if (e50Prev == null) return null;
  const fg = ctx.data('fear_greed');
  if (fg == null) return null;

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const ratio = atrF / atrS;
  const falling = e50 < e50Prev;
  const deRisked = ctx.state.deRisked === true;
  const shouldDeRisk = ratio >= 2.2 && falling;
  const shouldRestore = ratio <= 1.5;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;
  const equity = ctx.cash + ctx.position * price;

  // Cooldown after a hard stop: 40 bars (about a week of 4h) before re-entry.
  const cooldown = ctx.state.cooldown || 0;
  const inCooldown = cooldown > 0;
  if (inPos) ctx.state.cooldown = 0;
  else if (cooldown > 0) ctx.state.cooldown = cooldown - 1;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend, not euphoric', conds:[{label:'F&G', now: fg, op:'<', ref: 85, closed:true},{label:'cooldown', ok: !inCooldown}] },
    ...(inPos ? [
      { side:'sell', price: e200, trigger:'below', note:'trend broke' },
      { side:'sell', price: stop, trigger:'below', note:'hard stop' }
    ] : [])
  ]);

  if (inPos && ctx.entryPx != null) {
    if (price <= stop) { ctx.state.deRisked = false; ctx.state.cooldown = 40; return { side:'sell', qty: ctx.position, reduceOnly: true }; }
    if (!up) { ctx.state.deRisked = false; return { side:'sell', qty: ctx.position, reduceOnly: true }; }
    if (!deRisked && shouldDeRisk) {
      ctx.state.deRisked = true;
      const diff = ctx.position - (equity / price) * 0.4;
      if (diff > (equity / price) * 0.05) return { side:'sell', qty: diff * 0.99, reduceOnly: true };
    } else if (deRisked && shouldRestore) {
      ctx.state.deRisked = false;
      const diff = (equity / price) * 0.99 - ctx.position;
      if (diff > (equity / price) * 0.05) return { side:'buy', qty: diff * 0.99 };
    }
    return null;
  }
  if (up && fg < 85 && !inCooldown) {
    const qty = deRisked ? (equity / price) * 0.4 : (equity / price) * 0.99;
    return { side:'buy', qty: qty };
  }
  return null;
}
