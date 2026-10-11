/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Regime MR 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: on-chain active addresses measure real network usage; when usage is growing
 * (addresses above their 30-day average), BTC dips tend to recover, so mean-reversion buys are
 * safer. When usage is shrinking, stay in cash.
 * When it buys and sells: buys when price touches the lower Bollinger Band while active addresses
 * are above their 30-day average; sells when price returns to the middle band or hits a 2xATR stop.
 * When it does NOT work: in a prolonged bear market active addresses keep falling, so it stays in
 * cash and misses the eventual bottom; in a melt-up it exits at the middle band and leaves gains
 * on the table.
 */
function onUpdate(ctx) {
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const bb = ctx.bb(20, 2, 1);
  const atr = ctx.atr(14, 1);
  if (addr == null || addrSma == null || bb == null || atr == null) return null;

  const networkUp = addr > addrSma; // growing network participation = healthy regime

  if (ctx.position > 0) {
    const stopPx = ctx.entryPx - 2 * atr; // hard stop caps any single loss
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'below', note: 'MR target' },
      { side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' }
    ]);
    if (ctx.price >= bb.mid) return { side: 'sell', qty: ctx.position };
    if (ctx.entryPx != null && ctx.price <= stopPx) return { side: 'sell', qty: ctx.position };
    return null;
  }

  if (networkUp && ctx.price <= bb.lower) {
    ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower',
      conds: [{ label: 'active addr > SMA30', ok: networkUp }] }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower' }]);
  return null;
}
