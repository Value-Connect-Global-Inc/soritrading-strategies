/*
 * @coinsori-strategy v1
 * name: BTC Vol-Target Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends for weeks on the 4h chart, but its volatility
 * swings a lot — a quiet week moves 1% a day, a panic week moves 5%. Instead of
 * betting the same amount every time, this strategy sizes each position so the
 * *risk* is the same: near-fully invested when volatility is low, much smaller
 * when volatility is high. Same trend edge, much smaller drawdowns.
 * When it buys and sells: buys when price closes above a rising 200-bar average
 * (confirmed uptrend); sells when price closes below a FALLING 200-bar average
 * (the trend has rolled over, not just a dip) or on a 30% hard stop.
 * When it does NOT work: in a straight-up bull market it holds less during the
 * exciting (high-volatility) legs, so buy-and-hold can beat it on the upside;
 * in a range near the 200-bar line it whipsaws and pays fees.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);        // trend line, closed bar
  const smaOld = ctx.sma(200, 30);    // trend line 30 bars (5 days) ago, for slope
  const atr = ctx.atr(14, 1);         // 4h volatility, closed bar
  if (sma == null || smaOld == null || atr == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;
  const st = ctx.state;

  const RISK_BUDGET = 0.010;  // 1% of account at risk per 4h bar (constant-risk sizing)
  const MAX_QTY_FRAC = 0.98;  // never use more than 98% of cash
  const MIN_QTY_FRAC = 0.05;  // never go below 5% even in extreme vol
  const STOP_PCT = 0.70;      // hard stop: sell if price falls 30% below entry

  // ---- while holding: exits ----
  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : price;
    const watchList = [
      { side: 'sell', price: sma, trigger: 'below', note: 'Trend rollover exit' },
      { side: 'sell', price: entry * STOP_PCT, trigger: 'below', note: 'Hard stop -30%' },
    ];
    ctx.watch(watchList);

    // exit only when the trend has rolled over: price below a FALLING SMA200
    if (price < sma && sma < smaOld) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= entry * STOP_PCT) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // ---- flat: enter in a confirmed uptrend, size by inverse volatility ----
  ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'Uptrend entry (rising SMA200)' }]);
  if (price > sma && sma > smaOld) {
    const atrPct = atr / price;
    let frac = atrPct > 0 ? RISK_BUDGET / atrPct : MAX_QTY_FRAC;
    if (frac > MAX_QTY_FRAC) frac = MAX_QTY_FRAC;
    if (frac < MIN_QTY_FRAC) frac = MIN_QTY_FRAC;
    return { side: 'buy', qty: (ctx.cash / price) * frac };
  }
  return null;
}
