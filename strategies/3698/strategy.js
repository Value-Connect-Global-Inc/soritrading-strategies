/*
 * @coinsori-strategy v1
 * name: VolTargetTrendRider
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: instead of timing breakouts, it rides an established
 * uptrend (price above its 50-day and 200-day averages) while sizing each
 * position by inverse volatility so every position risks the same fixed dollar
 * amount. The key mechanism is risk management — position size adapts to
 * market volatility, not a clever entry.
 * When it buys and sells: buy when a close is above BOTH the 50-day and
 * 200-day averages; sell when a close falls below the 50-day average or price
 * hits a 2x ATR stop below entry. Each asset is sized to risk 1% of equity.
 * When it does NOT work: in a choppy sideways market where price oscillates
 * around the 50-day average it churns (buys near the top of each wiggle, sells
 * near the bottom). The 200-day filter keeps it out of deep bears, but a slow
 * grinding bear where price stays above the 200-day for a while still hurts.
 * It also misses the first strong leg of a new uptrend that starts below the
 * 200-day average.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }
  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma50 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop || prevClose < sma50) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma50, trigger: 'below', note: 'trend exit' }]);
    return null;
  }

  // Volatility-targeted size: risk a fixed 1% of equity per position via a
  // 2x ATR stop, then cap a single position at 40% of equity so low-vol coins
  // cannot over-leverage the book. 1% x 3 assets = max 3% of equity at risk.
  const riskPerTrade = 0.01 * ctx.cash;
  let qty = riskPerTrade / (2 * atr);
  const maxQty = (ctx.cash / price) * 0.40;
  qty = Math.min(qty, maxQty);

  if (prevClose > sma200 && prevClose > sma50) {
    ctx.watch([]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma50, trigger: 'above', note: 'trend re-entry',
               conds: [{ label: 'close>200d', ok: prevClose > sma200 }] }]);
  return null;
}
