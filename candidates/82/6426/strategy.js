/*
 * @coinsori-strategy v1
 * name: BTC Dual-Direction Trend 4H USDM
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: a long-only trend strategy stands aside in downtrends and
 * so misses half the action while still paying fees — that is why it loses to
 * buy-and-hold. On a perpetual we can SHORT the downtrend too, so the strategy
 * makes money in both directions and no longer needs a rising market to win.
 *
 * When it buys and sells: LONG when price closes above a rising 200-bar average;
 * SHORT when price closes below a falling 200-bar average. Position is sized so
 * the risk per bar is constant (smaller when volatility is high). Exits when the
 * trend rolls over the other way or a 3*ATR hard stop hits.
 *
 * When it does NOT work: in a choppy sideways market near the 200-bar line it
 * whipsaws between long and short and pays fees both ways; a violent reversal
 * against the position can hit the stop before the trend flips.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  const smaOld = ctx.sma(200, 30);
  const atr = ctx.atr(14, 1);
  if (sma == null || smaOld == null || atr == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;
  const entry = ctx.entryPx != null ? ctx.entryPx : price;

  const RISK_BUDGET = 0.010;  // 1% of account at risk per 4h bar (constant-risk sizing)
  const MAX_QTY_FRAC = 0.98;
  const MIN_QTY_FRAC = 0.05;
  const STOP_ATR = 3;         // hard stop at 3*ATR from entry

  const up = price > sma && sma > smaOld;    // confirmed uptrend
  const down = price < sma && sma < smaOld;  // confirmed downtrend
  const stopDist = STOP_ATR * atr;
  const stopLong = entry - stopDist;
  const stopShort = entry + stopDist;

  const orders = [];
  const watch = [];

  if (pos === 0) {
    if (up) {
      const atrPct = atr / price;
      let frac = atrPct > 0 ? RISK_BUDGET / atrPct : MAX_QTY_FRAC;
      if (frac > MAX_QTY_FRAC) frac = MAX_QTY_FRAC;
      if (frac < MIN_QTY_FRAC) frac = MIN_QTY_FRAC;
      orders.push({ side: 'buy', qty: (ctx.cash / price) * frac });
      watch.push({ side: 'buy', price: sma, trigger: 'above', note: 'Long uptrend' });
    } else if (down) {
      const atrPct = atr / price;
      let frac = atrPct > 0 ? RISK_BUDGET / atrPct : MAX_QTY_FRAC;
      if (frac > MAX_QTY_FRAC) frac = MAX_QTY_FRAC;
      if (frac < MIN_QTY_FRAC) frac = MIN_QTY_FRAC;
      orders.push({ side: 'sell', qty: (ctx.cash / price) * frac });
      watch.push({ side: 'sell', price: sma, trigger: 'below', note: 'Short downtrend' });
    }
  } else if (pos > 0) {
    // long: exit on trend rollover down or hard stop
    if (price < sma && sma < smaOld) orders.push({ side: 'sell', qty: pos, reduceOnly: true });
    else if (price <= stopLong) orders.push({ side: 'sell', qty: pos, reduceOnly: true });
    watch.push({ side: 'sell', price: sma, trigger: 'below', note: 'Long trend rollover' });
    watch.push({ side: 'sell', price: stopLong, trigger: 'below', note: 'Long stop' });
  } else {
    // short: exit on trend rollover up or hard stop
    if (price > sma && sma > smaOld) orders.push({ side: 'buy', qty: Math.abs(pos), reduceOnly: true });
    else if (price >= stopShort) orders.push({ side: 'buy', qty: Math.abs(pos), reduceOnly: true });
    watch.push({ side: 'buy', price: sma, trigger: 'above', note: 'Short trend rollover' });
    watch.push({ side: 'buy', price: stopShort, trigger: 'above', note: 'Short stop' });
  }

  ctx.watch(watch);
  return orders.length ? orders : null;
}
