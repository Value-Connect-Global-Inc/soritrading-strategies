/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend + Vol-Target Size 1D (baseline copy)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The pure 200-day trend is this job's best result but it stays
 * 100% invested through crashes and gives back a big drawdown before the slow
 * 200-day exit fires. This version scales HOW MUCH we buy: high daily volatility
 * (crash regime) => invest less; calm volatility => fully invested. Same trades,
 * smaller drawdown.
 * When it buys and sells: Buys when the previous close is above the 200-day
 * average. Position size = min(1, 3% / ATR(20)-as-percent-of-price) of cash.
 * Sells when the close falls below the 200-day average. No other exits.
 * When it does NOT work: In a long sideways range it whipsaws across the 200-day
 * line. It lags sharp V-shaped recoveries. It is under-invested in high-vol bull
 * spikes (e.g. early 2021) and can miss part of a violent rally.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const atr20 = ctx.atr(20, 1);
  if (sma200 == null || atr20 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'close above SMA200' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200' }
  ]);

  if (pos > 0) {
    if (prevClose < sma200) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > sma200) {
    // vol-target: 3% daily ATR = full size, scale down linearly as vol rises
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct);
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
