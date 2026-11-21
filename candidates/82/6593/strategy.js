/*
 * @coinsori-strategy v1
 * name: BTC 4h Give-Back Protected Trend Ride
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A trend filter rides big uptrends but is late to exit in slow
 * grind-downs that have normal volatility (an ATR spike only catches fast crashes).
 * Instead it protects a fraction of each run's profit: when price falls 15% from the
 * highest point reached since entry, cut to 40%; exit fully at 25%. Restore to full only
 * when price climbs back within 8% of the peak. This caps drawdown on both fast crashes
 * and slow bears, and the hysteresis band stops it from flickering and churning fees.
 * When it buys: EMA50 above EMA200 (uptrend) — full position in calm markets.
 * When it sells: EMA50 falls below EMA200, price gives back 25% from its run high, or
 * de-risks to 40% at a 15% give-back (restore only within 8% of the peak).
 * When it does NOT work: in a wide choppy range a 15% pullback is normal, so it keeps
 * cutting to 40% and gives up upside; in a violent V-recovery it exits late and re-enters
 * higher.
 */

function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2) || price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;

  // highest CLOSED bar since entry = the peak of the current run
  let hi = ctx.state.hi || 0;
  if (inPos && prevClose > hi) hi = prevClose;
  ctx.state.hi = hi;

  const giveback = inPos && hi > 0 ? 1 - price / hi : 0; // how much of the run is given back
  const deRisked = ctx.state.deRisked === true;
  const shouldDeRisk = giveback >= 0.15;   // 15% give-back = trend likely over, protect
  const shouldRestore = giveback <= 0.08;  // back within 8% of peak = run resumed
  const crashOut = giveback >= 0.25;       // 25% = confirmed break, get out fully

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'EMA50 over EMA200 (uptrend)', conds:[{label:'EMA50', now: e50, op:'>', ref: e200, closed:true}] },
    { side:'sell', price: e200, trigger:'below', note:'trend broke' },
    ...(inPos ? [{ side:'sell', price: hi * 0.75, trigger:'below', note:'give-back exit' }] : [])
  ]);

  // full exit on trend flip
  if (!up && inPos) {
    ctx.state.deRisked = false;
    ctx.state.hi = 0;
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }

  // confirmed give-back: exit fully, wait for the trend to re-establish
  if (crashOut) {
    ctx.state.deRisked = false;
    ctx.state.hi = 0;
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }

  const equity = ctx.cash + ctx.position * price;

  if (up && !inPos) {
    ctx.state.hi = price;
    const qty = deRisked ? (equity / price) * 0.4 : (equity / price) * 0.99;
    return { side:'buy', qty: qty };
  }

  if (up && inPos) {
    if (!deRisked && shouldDeRisk) {
      // 15% give-back: cut to 40% to protect the account
      ctx.state.deRisked = true;
      const target = (equity / price) * 0.4;
      const diff = ctx.position - target;
      if (diff > (equity / price) * 0.05) return { side:'sell', qty: diff * 0.99, reduceOnly: true };
    } else if (deRisked && shouldRestore) {
      // back within 8% of the peak: restore to full
      ctx.state.deRisked = false;
      const target = (equity / price) * 0.99;
      const diff = target - ctx.position;
      if (diff > (equity / price) * 0.05) return { side:'buy', qty: diff * 0.99 };
    }
  }
  return null;
}
