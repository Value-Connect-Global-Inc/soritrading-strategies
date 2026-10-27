/*
 * @coinsori-strategy v1
 * name: BTC Vol-Target Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: trend-following with volatility-targeted position sizing.
 * Instead of betting a fixed fraction, size by inverse of recent ATR so the
 * account is ~fully invested in calm uptrends and automatically de-risks when
 * volatility spikes (choppy or crashing regimes). Risk management first.
 * When it buys and sells: buys when price is above its 100-day average and the
 * 20-day average is rising; position size scales down as ATR(14) rises. Sells
 * when price closes below the 100-day average. A hard stop caps each loss.
 * When it does NOT work: in a long calm grinding bear where price stays above
 * the 100-day average while drifting down, it stays invested and bleeds; and
 * any trend signal lags sharp V-shaped reversals.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma100 = ctx.sma(100, 1);
  const sma20 = ctx.sma(20, 1);
  const sma20Prev = ctx.sma(20, 2);
  const atr = ctx.atr(14, 1);
  if (sma100 == null || sma20 == null || sma20Prev == null || atr == null) return null;

  const pos = ctx.position;
  const inTrend = price > sma100 && sma20 > sma20Prev;

  // Volatility target: scale position down as ATR grows (cap at ~3% of price).
  const atrPct = atr / price;
  const volScale = Math.max(0.15, Math.min(1.0, 0.03 / atrPct));

  const st = ctx.state;
  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma100, trigger: 'below', note: 'SMA100 trend break' },
      { side: 'sell', price: ctx.entryPx != null ? ctx.entryPx * 0.85 : 0, trigger: 'below', note: 'hard stop' }
    ]);
    // Hard stop: exit if down 15% from entry regardless of trend.
    if (ctx.entryPx != null && price < ctx.entryPx * 0.85) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (!inTrend) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: price, trigger: 'above', note: 'trend entry', conds: [
      { label: 'Price > SMA100', ok: price > sma100 },
      { label: 'SMA20 rising', ok: sma20 > sma20Prev }
    ]}
  ]);
  if (inTrend) {
    if (ctx.alloc.status !== 'ok') return null;
    const qty = ctx.cash / price * 0.95 * volScale;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
