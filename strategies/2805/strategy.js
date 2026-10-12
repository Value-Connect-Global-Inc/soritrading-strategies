// 2025-04-26 표시만 바뀜, 매매 판단은 그대로
/*
 * @coinsori-strategy v1
 * name: ETH 4H Band-Bounce Champion + Fed Gate + Trailing Exit
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The band-bounce mean-reversion champion (buy panic dips to
 * the lower Bollinger band with oversold RSI, above a 200-SMA uptrend) plus the
 * validated Fed-tightening gate is the strongest family in the ledger. The
 * champion's exit sells at the mid-band, which caps upside when a bounce turns
 * into a real rally. This version replaces the fixed mid-band exit with a
 * TRAILING stop: after buying a panic dip, it lets the position run while price
 * stays within a trailing distance of its post-entry high, so a strong bounce
 * that becomes a trend is not sold too early. It still takes profit on RSI
 * recovery above 50 and stops out on a hard drop.
 * When it buys and sells: buys a panic dip (price below the lower Bollinger
 * band, RSI<30, price above the 200-SMA) and sells when price falls a trailing
 * 3x ATR below its highest point since entry, or when RSI recovers above 50, or
 * an absolute 5x ATR stop. It takes NO buy while the Fed is tightening.
 * When it does NOT work: in a choppy range where a bounce stalls just below
 * resistance, the trailing stop gives back more than the old mid-band exit; and
 * in a tightening cycle it stands in cash and misses genuine panic-bottom
 * bounces.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const fedNow = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  if (fedNow == null || fedLag == null) {
    ctx.watch([]);
    return null;
  }
  const tightening = fedNow > fedLag + 0.5;

  const pos = ctx.position;
  const atr = ctx.atr(14, 1);

  if (pos > 0) {
    const bb = ctx.bb(20, 2, 1);
    const rsi = ctx.rsi(14, 1);
    if (bb == null || rsi == null || atr == null) {
      ctx.watch([]);
      return null;
    }
    const entry = ctx.entryPx;
    // Track highest high since entry for the trailing stop.
    const hh = ctx.state.hh != null ? Math.max(ctx.state.hh, price) : price;
    ctx.state.hh = hh;

    const stopTrail = hh - 3 * atr;
    const stopHard = entry != null ? entry - 5 * atr : null;

    const exitWatch = [];
    if (Number.isFinite(stopTrail)) {
      exitWatch.push({ side: 'sell', price: stopTrail, trigger: 'below', qty: pos, note: 'trailing stop 3ATR' });
    }
    if (stopHard != null && Number.isFinite(stopHard)) {
      exitWatch.push({ side: 'sell', price: stopHard, trigger: 'below', qty: pos, note: 'hard stop 5ATR' });
    }
    exitWatch.push({
      side: 'sell',
      note: 'RSI take-profit',
      conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 50, closed: true }]
    });
    ctx.watch(exitWatch);

    // Sell on RSI recovery, trailing 3x ATR under the post-entry high, or 5x ATR stop.
    if (rsi > 50 || price <= hh - 3 * atr || (entry != null && price <= entry - 5 * atr)) {
      ctx.state.hh = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Stand aside during a Fed tightening cycle.
  if (tightening) {
    ctx.watch([]);
    return null;
  }

  const sma200 = ctx.sma(200, 1);
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  if (sma200 == null || bb == null || rsi == null) {
    ctx.watch([]);
    return null;
  }

  const lastTrade = ctx.state.lastTradeBar != null ? ctx.state.lastTradeBar : -1e9;
  ctx.watch([{
    side: 'buy',
    price: bb.lower,
    trigger: 'below',
    qty: (ctx.cash / price) * 0.98,
    note: 'BB lower panic dip',
    conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'Price > SMA200 close', now: price, op: '>', ref: sma200 },
      { label: 'Cooldown bars', now: ctx.i - lastTrade, op: '>=', ref: 5 },
      { label: 'Fed not tightening', ok: !tightening }
    ]
  }]);

  if (price <= sma200) return null;
  if (price > bb.lower) return null;
  if (rsi >= 30) return null;

  if (ctx.i - lastTrade < 5) return null;
  ctx.state.lastTradeBar = ctx.i;
  ctx.state.hh = price;

  return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
}
