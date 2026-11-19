/*
 * @coinsori-strategy v1
 * name: BTC 4h De-Risk Trend Ride + Hard Stop
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A trend filter rides big uptrends but takes deep drawdowns in fast
 * crashes that moving averages lag. It combines two protections: (1) when volatility
 * spikes AND the trend turns down, cut to 40% (restore only when vol calms); (2) a wide
 * hard stop-loss at 20% below the entry price caps any single position's loss in a fast
 * crash. The -20% stop is wide enough that normal bull pullbacks rarely touch it, so the
 * upside of a strong trend is mostly kept while the tail risk of a crash is capped.
 * When it buys: EMA50 above EMA200 (uptrend) — full position in calm markets.
 * When it sells: EMA50 falls below EMA200, price hits the -20% hard stop, or de-risks to
 * 40% at 2.2x normal vol while the trend is falling (restore only when vol calms).
 * When it does NOT work: in a volatile chop where ATR stays at the extreme threshold it
 * holds at reduced size and gives up upside; a -20% stop can be hit by a sharp intra-trend
 * shakeout and force a re-entry at a worse price.
 */

function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const atrF = ctx.atr(14, 1);
  const atrS = ctx.atr(100, 1);
  if (atrF == null || atrS == null) return null;
  const e50Prev = ctx.ema(50, 6); // 50-EMA direction ~1 day ago (6 x 4h)
  if (e50Prev == null) return null;

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const ratio = atrF / atrS; // fast vs slow volatility; >1 = currently more volatile than normal
  const falling = e50 < e50Prev; // trend rolling over, not a launch

  // hysteresis: de-risk at 2.2x normal vol ONLY while the trend falls, restore under 1.5x
  const deRisked = ctx.state.deRisked === true;
  const shouldDeRisk = ratio >= 2.2 && falling;
  const shouldRestore = ratio <= 1.5;

  // hard stop: 20% below entry cost basis — caps any single position's loss in a fast crash
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'EMA50 over EMA200 (uptrend)', conds:[{label:'EMA50', now: e50, op:'>', ref: e200, closed:true}] },
    { side:'sell', price: e200, trigger:'below', note:'trend broke' },
    ...(inPos ? [{ side:'sell', price: stop, trigger:'below', note:'hard stop' }] : [])
  ]);

  // hard stop exit: protect the account when the trend flip lags a fast crash
  if (inPos && ctx.entryPx != null && price <= stop) {
    ctx.state.deRisked = false;
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }

  // full exit on trend flip
  if (!up && inPos) {
    ctx.state.deRisked = false;
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }

  const equity = ctx.cash + ctx.position * price;

  if (up && !inPos) {
    // enter: full size unless volatility is already extreme and falling
    const qty = deRisked ? (equity / price) * 0.4 : (equity / price) * 0.99;
    return { side:'buy', qty: qty };
  }

  if (up && inPos) {
    if (!deRisked && shouldDeRisk) {
      // crash signature: cut to 40% to protect the account from a fast decline
      ctx.state.deRisked = true;
      const target = (equity / price) * 0.4;
      const diff = ctx.position - target;
      if (diff > (equity / price) * 0.05) return { side:'sell', qty: diff * 0.99, reduceOnly: true };
    } else if (deRisked && shouldRestore) {
      // volatility calmed: go back to full
      ctx.state.deRisked = false;
      const target = (equity / price) * 0.99;
      const diff = target - ctx.position;
      if (diff > (equity / price) * 0.05) return { side:'buy', qty: diff * 0.99 };
    }
  }
  return null;
}
