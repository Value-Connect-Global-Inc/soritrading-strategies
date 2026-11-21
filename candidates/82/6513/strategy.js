/*
 * @coinsori-strategy v1
 * name: BTC Trend YieldGate 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends for weeks on the 4h chart, but its
 * volatility swings a lot. This sizes each position so the RISK is constant
 * (smaller in high-volatility weeks) and only holds in confirmed uptrends.
 * On top of that, a macro gate uses the US yield curve (10Y minus 2Y): when
 * the curve is deeply inverted (a classic recession warning), risk assets
 * tend to fall, so we step aside. The gate rarely binds, so it does not add
 * much trading — it just protects against macro risk-off periods.
 * When it buys and sells: Long when price closes above a rising 200-bar
 * average AND the yield-curve spread is not deeply inverted. Exit only when
 * the trend truly rolls over (price below a FALLING 200-bar average — not a
 * mere dip) or on a 30% hard stop.
 * When it does NOT work: In a straight-up bull market it holds less during
 * high-volatility legs, so buy-and-hold can beat it on the upside; in a range
 * near the 200-bar line it whipsaws and pays fees.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);        // trend line, closed bar
  const smaOld = ctx.sma(200, 30);    // trend line 30 bars ago, for slope
  const atr = ctx.atr(14, 1);         // 4h volatility, closed bar
  if (sma == null || smaOld == null || atr == null) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;
  const price = ctx.price;
  if (price == null) { ctx.watch([]); return null; }

  // Macro gate: yield-curve spread (10Y minus 2Y). Deeply inverted = risk-off.
  const spread = ctx.data("base.t10y2y");
  const riskOff = spread != null && spread < -0.50; // gate only when deeply inverted

  const RISK_BUDGET = 0.010;  // 1% of account at risk per bar (constant-risk sizing)
  const MAX_QTY_FRAC = 0.98;  // never use more than 98% of cash
  const MIN_QTY_FRAC = 0.05;  // never go below 5% even in extreme vol
  const STOP_PCT = 0.70;      // hard stop: exit if price falls 30% below entry

  const uptrend = price > sma && sma > smaOld;         // entry condition: rising trend
  const rolledOver = price < sma && sma < smaOld;      // exit condition: trend truly rolled

  const atrPct = atr / price;
  let frac = atrPct > 0 ? RISK_BUDGET / atrPct : MAX_QTY_FRAC;
  if (frac > MAX_QTY_FRAC) frac = MAX_QTY_FRAC;
  if (frac < MIN_QTY_FRAC) frac = MIN_QTY_FRAC;

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
      { side: 'sell', price: entry * STOP_PCT, trigger: 'below', note: 'hard stop -30%' },
      { side: 'sell', price: price, trigger: 'below', note: 'yield-curve risk-off' }
    ]);
    if (rolledOver || price <= entry * STOP_PCT || riskOff) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // ---- flat: enter only in a confirmed uptrend and not risk-off ----
  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }
  if (uptrend && !riskOff) {
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'uptrend entry' }]);
    return { side: 'buy', qty: (ctx.cash / price) * frac };
  }
  ctx.watch([]);
  return null;
}
