/*
 * @coinsori-strategy v1
 * name: BTC 4h Volatility De-Risk Trend Ride + Trailing Stop
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A trend filter rides big uptrends but takes deep drawdowns in fast
 * crashes that moving averages lag. It has one hard switch: when volatility spikes to an
 * extreme, cut the position to 40%; only go back to full when volatility calms (hysteresis
 * band stops flicker). A wide trailing stop (3x ATR) caps the drawdown when the trend flip
 * arrives too late, so a fast crash cannot run far past the exit point.
 * When it buys: EMA50 above EMA200 (uptrend) — full position in calm markets.
 * When it sells: EMA50 falls below EMA200 (downtrend), price breaks the trailing stop, or
 * volatility is extreme (cut to 40%, restore only when it calms).
 * When it does NOT work: in a volatile chop where ATR stays at the extreme threshold it
 * holds at reduced size and gives up upside; a wide trailing stop can be hit by a sharp
 * intra-trend shakeout and force a re-entry at a worse price.
 */

function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const atrF = ctx.atr(14, 1);
  const atrS = ctx.atr(100, 1);
  if (atrF == null || atrS == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2) || price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const ratio = atrF / atrS; // fast vs slow volatility; >1 = currently more volatile than normal

  // hysteresis: de-risk at 2.2x normal vol, restore only when back under 1.5x (avoid flicker)
  const deRisked = ctx.state.deRisked === true;
  const shouldDeRisk = ratio >= 2.2;
  const shouldRestore = ratio <= 1.5;

  // trailing stop: ratchet up with the highest CLOSED bar since entry, stop 3x ATR(14) below
  let hi = ctx.state.hi || 0;
  if (inPos && prevClose > hi) hi = prevClose;
  ctx.state.hi = hi;
  const stop = inPos ? hi - 3 * atrF : 0;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'EMA50 over EMA200 (uptrend)', conds:[{label:'EMA50', now: e50, op:'>', ref: e200, closed:true}] },
    { side:'sell', price: e200, trigger:'below', note:'trend broke' },
    ...(inPos ? [{ side:'sell', price: stop, trigger:'below', note:'trailing stop' }] : [])
  ]);

  // hard stop first: protects the account when the trend flip lags the crash
  if (inPos && price <= stop) {
    ctx.state.deRisked = false;
    ctx.state.hi = 0;
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }

  // full exit on trend flip
  if (!up && inPos) {
    ctx.state.deRisked = false;
    ctx.state.hi = 0;
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }

  const equity = ctx.cash + ctx.position * price;

  if (up && !inPos) {
    // enter: full size unless volatility is already extreme
    ctx.state.hi = price;
    const qty = deRisked ? (equity / price) * 0.4 : (equity / price) * 0.99;
    return { side:'buy', qty: qty };
  }

  if (up && inPos) {
    if (!deRisked && shouldDeRisk) {
      // volatility spike: cut to 40% to protect the account from a fast crash
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
