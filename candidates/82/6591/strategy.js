/*
 * @coinsori-strategy v1
 * name: BTC 4h Volatility De-Risk Trend Ride
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A trend filter rides big uptrends but takes deep drawdowns in fast
 * crashes that moving averages lag. Instead of rebalancing constantly (which churns fees),
 * this version has one hard switch: when volatility spikes to an extreme, cut the position
 * to 40%; only go back to full when volatility calms to a normal level. A hysteresis band
 * stops it from flickering and churning fees.
 * When it buys: EMA50 above EMA200 (uptrend) — full position in calm markets.
 * When it sells: EMA50 falls below EMA200 (downtrend) — sell all; also cut to 40% when
 * volatility is extreme and restore to full only when it calms.
 * When it does NOT work: in a volatile chop where ATR stays at the extreme threshold, it
 * holds at reduced size and gives up upside; in a slow low-vol bear it is late to exit.
 */

function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const atrF = ctx.atr(14, 1);
  const atrS = ctx.atr(100, 1);
  if (atrF == null || atrS == null) return null;

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const ratio = atrF / atrS; // fast vs slow volatility; >1 = currently more volatile than normal

  // hysteresis: de-risk at 2.2x normal vol, restore only when back under 1.5x (avoid flicker)
  const deRisked = ctx.state.deRisked === true;
  const shouldDeRisk = ratio >= 2.2;
  const shouldRestore = ratio <= 1.5;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'EMA50 over EMA200 (uptrend)', conds:[{label:'EMA50', now: e50, op:'>', ref: e200, closed:true}] },
    { side:'sell', price: e200, trigger:'below', note:'trend broke' }
  ]);

  // full exit on trend flip
  if (!up && inPos) {
    ctx.state.deRisked = false;
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }

  const equity = ctx.cash + ctx.position * price;

  if (up && !inPos) {
    // enter: full size unless volatility is already extreme
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
