/*
 * @coinsori-strategy v1
 * name: Onchain Hashrate Probe
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic probe for the hashrate dataset. Buys whenever
 * ctx.data('hashrate') is a usable finite number, so the trade count reveals
 * whether the miner-activity dataset populates per-bar (addr proved the on-chain
 * feed is live; this checks hashrate as a second on-chain axis).
 * When it buys and sells: buys when the value is usable, sells when not.
 * When it does NOT work: if the key is null, the probe stays flat.
 *
 * 2025-02-15: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const raw = ctx.data('hashrate');
  const n = Number(raw);
  const usable = Number.isFinite(n) && n > 0;
  if (pos > 0) {
    if (!usable) {
      ctx.watch([{ side: 'sell', price: ctx.price, trigger: 'below', note: 'hashrate unusable' }]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([]);
    return null;
  }
  if (usable) {
    ctx.watch([{ side: 'buy', price: ctx.price, trigger: 'above', note: 'hashrate usable' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  ctx.watch([]);
  return null;
}
