/*
 * @coinsori-strategy v1
 * name: Hashrate-Confirmed BTC Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's network hash rate measures how much computing
 *   power miners commit to the chain. When hash rate is above its own 30-day
 *   average, miners are adding capacity — a sign of network health and
 *   conviction — which historically lines up with rising prices. We only buy
 *   BTC when BOTH the price trend (above the 50-day EMA) and the network trend
 *   (hash rate above its 30-day average) point up.
 * When it buys and sells: buy BTC when the close is above the 50-day EMA AND
 *   hash rate is above its 30-day average. Sell when price falls 20% below its
 *   highest close since entry, or when a 2.5x ATR hard stop hits.
 * When it does NOT work: hash rate is a slow, lagging series — it can stay
 *   high for weeks after price tops, so the strategy can buy late into a
 *   rally. In a bear market the 50-day EMA keeps it mostly in cash but it
 *   misses the bottom. It is long-only and single-asset (BTC).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const hr = ctx.data('hashrate');
  const hrSma30 = ctx.data('hashrate_sma30');
  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (hr == null || hrSma30 == null || ema50 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const peak = Math.max(ctx.state.peak || prevClose, prevClose);
    ctx.state.peak = peak;
    const trailStop = peak * 0.80;             // give back 20% of the run before exiting
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (price <= trailStop) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: trailStop, trigger: 'below', note: 'trailing -20%' }]);
    return null;
  }

  const networkUp = hr > hrSma30;              // miners adding capacity
  const uptrend = prevClose > ema50;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'uptrend + hash rate rising',
               conds: [{ label: 'hashrate > sma30', ok: networkUp, closed: true },
                       { label: 'close > 50-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend) return null;
  if (!networkUp) return null;

  const riskCash = ctx.cash * 0.02;            // risk 2% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
