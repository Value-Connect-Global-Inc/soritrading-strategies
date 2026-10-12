/*
 * @coinsori-strategy v1
 * name: On-Chain Trend BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: On-chain activity (BTC active addresses) is a slow,
 * organic measure of real network demand — a fundamentally different signal
 * family from price bands or momentum. When network usage is growing above
 * its own 30-day average, it signals a healthy adoption trend worth riding.
 * When it is shrinking, demand is fading and price rallies are suspect.
 * When it buys and sells: buys only when price is above its 200-day SMA AND
 * active addresses are above their 30-day average (both trend-confirming).
 * Sells when either trend breaks (price below 200-SMA or addresses below
 * their 30-day average), or a 10-ATR trailing stop is hit.
 * When it does NOT work: lags sharp V-shaped bottoms (waits for on-chain
 * confirmation that lags price) and churns sideways chop where both signals
 * flip-flop. On-chain data is daily so it cannot time intraday moves.
 *
 * 2024-01-15: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const price = ctx.price;
  const pos = ctx.position;

  // On-chain data is daily; on a 1d chart ctx.data returns the value aligned
  // to the current bar. Guard for null (missing / not yet loaded).
  const addr = ctx.data('addr');
  const addrSma30 = ctx.data('addr_sma30');
  if (addr == null || addrSma30 == null) return null;
  const onchainUp = addr > addrSma30;

  if (pos > 0) {
    // Exit when either trend breaks, or trailing stop hit.
    if (price < sma200 || !onchainUp) {
      ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: '200-SMA trend break' }]);
      return { side: 'sell', qty: pos };
    }
    const atr = ctx.atr(14, 1);
    if (atr != null && price <= ctx.entryPx - atr * 10) {
      ctx.watch([{ side: 'sell', price: ctx.entryPx - atr * 10, trigger: 'below', note: '10-ATR trailing stop' }]);
      return { side: 'sell', qty: pos };
    }
    const stopPx = ctx.entryPx - atr * 10;
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: '200-SMA trend break' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '10-ATR trailing stop' }
    ]);
    return null;
  }

  // Enter only when BOTH trends confirm: price above 200-SMA and on-chain
  // network growth positive. Slow, deliberate, trend-following entry.
  if (price > sma200 && onchainUp) {
    ctx.watch([]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.98 };
  }
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: '200-SMA trend', conds: [{ label: 'On-chain addr > 30d avg', ok: onchainUp, closed: true }] }
  ]);
  return null;
}
