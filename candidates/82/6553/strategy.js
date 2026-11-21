/*
 * @coinsori-strategy v1
 * name: BTC Onchain Adoption Sizing 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's on-chain activity (daily unique active addresses)
 * is a slow, crypto-native regime signal. Instead of an on/off gate, scale
 * position size continuously with adoption: more exposure when network usage is
 * expanding relative to its own 30-day average, less when contracting. This keeps
 * the strategy in the market during bull runs (so it can match holding) while
 * reducing exposure in weak regimes (so drawdown stays small).
 * When it buys and sells: Always hold a position while price is above its 200-day
 * average. Size scales with the adoption ratio (0.75x to 1x of cash). Exit fully
 * when price closes below SMA200. A 25% deadband avoids churning on tiny changes.
 * When it does NOT work: In a strong bull with flat on-chain usage it holds less
 * than full size and underperforms holding. Adoption data is slow, so it lags
 * sharp V-shaped recoveries.
 */
function onUpdate(ctx) {
  const addr = ctx.data("addr");
  const addrSma = ctx.data("addr_sma30");
  const sma200 = ctx.sma(200, 1);
  if (addr == null || addrSma == null || addrSma <= 0 || sma200 == null) return null;
  const ratio = addr / addrSma; // 1 = usage at its own 30-day average
  const close = ctx.closes.at(-2);
  if (close == null) return null;

  if (ctx.position <= 0) {
    if (close > sma200) {
      ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 uptrend',
        conds: [{ label: 'addr ratio', now: ratio, op: '>', ref: 0.0, closed: true }] }]);
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 uptrend' }]);
    return null;
  }

  if (close < sma200) {
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' }]);
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }

  // Scale position with adoption: 0.75x when contracting, up to 1x when expanding.
  // Clamp ratio to [0.75, 1.5], map to target fraction of cash in [0.75, 1.0].
  const clamped = Math.max(0.75, Math.min(1.5, ratio));
  const targetFrac = 0.75 + (clamped - 0.75) * (0.25 / 0.75); // 0.75..1.0
  const targetQty = ctx.cash / ctx.price * targetFrac * 0.99;
  const diff = targetQty - ctx.position;
  ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' },
    { side: 'buy', price: close, trigger: 'above', note: 'size up w/ adoption',
      conds: [{ label: 'addr ratio', now: ratio, op: '>', ref: 1.0, closed: true }] }]);
  // 25% deadband: only rebalance when the gap is meaningful, to avoid daily churn
  if (Math.abs(diff) < ctx.position * 0.25) return null;
  if (diff > 0) return { side: 'buy', qty: diff };
  return { side: 'sell', qty: -diff, reduceOnly: true };
}
