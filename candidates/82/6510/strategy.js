/*
 * @coinsori-strategy v1
 * name: BTC Trend Long-Short 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends for weeks on the 4h chart, but its
 * volatility swings a lot. Instead of betting a fixed amount, this sizes each
 * position so the RISK is constant (smaller in high-volatility weeks). Unlike
 * a long-only version, it trades BOTH directions: long in confirmed uptrends,
 * short in confirmed downtrends, so it can make money when the market falls
 * too — a return source buy-and-hold does not have.
 * When it buys and sells: Long when price closes above a rising 200-bar
 * average (confirmed uptrend). Short when price closes below a falling 200-bar
 * average (confirmed downtrend). A 30% hard stop protects every position.
 * When it does NOT work: in a tight range near the 200-bar line the trend
 * flips and it whipsaws, paying fees both ways; in a violent spike it can be
 * stopped out on the wrong side before the trend confirms.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);        // trend line, closed bar
  const smaOld = ctx.sma(200, 30);    // trend line 30 bars ago, for slope
  const atr = ctx.atr(14, 1);         // 4h volatility, closed bar
  if (sma == null || smaOld == null || atr == null) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;
  const price = ctx.price;
  if (price == null) { ctx.watch([]); return null; }

  const RISK_BUDGET = 0.010;  // 1% of account at risk per bar (constant-risk sizing)
  const MAX_QTY_FRAC = 0.90;  // never use more than 90% of cash/margin
  const MIN_QTY_FRAC = 0.05;  // never go below 5% even in extreme vol
  const STOP_PCT = 0.70;      // hard stop: exit if price moves 30% against entry

  const uptrend = price > sma && sma > smaOld;     // rising trend
  const downtrend = price < sma && sma < smaOld;   // falling trend

  const atrPct = atr / price;
  let frac = atrPct > 0 ? RISK_BUDGET / atrPct : MAX_QTY_FRAC;
  if (frac > MAX_QTY_FRAC) frac = MAX_QTY_FRAC;
  if (frac < MIN_QTY_FRAC) frac = MIN_QTY_FRAC;
  const qty = (ctx.cash / price) * frac;

  // restart-surviving close of an existing position
  if (pos !== 0 && ctx.entryPx == null) {
    const side = pos > 0 ? 'sell' : 'buy';
    const flag = 'restartClose_' + side;
    ctx.watch([{ side: side, price: price, trigger: pos > 0 ? 'below' : 'above', note: 'restart close' }]);
    if (ctx.state[flag]) return null;
    ctx.state[flag] = true;
    return { side: side, qty: Math.abs(pos), reduceOnly: true };
  }

  // ---- while holding: exits ----
  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : price;
    ctx.watch([
      { side: 'sell', price: sma, trigger: 'below', note: 'trend rollover exit' },
      { side: 'sell', price: entry * STOP_PCT, trigger: 'below', note: 'hard stop -30%' }
    ]);
    if (!uptrend || price <= entry * STOP_PCT) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (pos < 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : price;
    ctx.watch([
      { side: 'buy', price: sma, trigger: 'above', note: 'trend rollover exit' },
      { side: 'buy', price: entry * (2 - STOP_PCT), trigger: 'above', note: 'hard stop +30%' }
    ]);
    if (!downtrend || price >= entry * (2 - STOP_PCT)) return { side: 'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  // ---- flat: enter on confirmed trend ----
  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }
  if (uptrend) {
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'uptrend entry' }]);
    return { side: 'buy', qty: qty };
  }
  if (downtrend) {
    ctx.watch([{ side: 'sell', price: sma, trigger: 'below', note: 'downtrend short' }]);
    return { side: 'sell', qty: qty };
  }
  ctx.watch([]);
  return null;
}
