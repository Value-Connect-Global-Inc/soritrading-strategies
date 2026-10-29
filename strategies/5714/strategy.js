/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend + Continuous Vol-Target 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Strategy 5714 sized the position only at entry, so it
 * stayed fully invested through a crash after volatility spiked — that is why
 * the 2018 bear produced a 49% drawdown. This version keeps the exact same
 * 200-day trend signal but re-sizes the position EVERY DAY to a volatility
 * target: high daily vol -> fewer coins, calm vol -> more coins. Same trend
 * timing, but the position shrinks by itself as a crash unfolds instead of
 * riding it down at full size.
 * When it buys and sells: Buys when the previous close is above the 200-day
 * average. Position = min(1, 3% / ATR(20)-as-percent-of-price) of equity,
 * re-checked daily with a wide deadband (20%) so we only rebalance when
 * volatility changes meaningfully, not on daily noise. Sells when the close
 * falls below the 200-day average (and sells down whenever volatility rises).
 * When it does NOT work: In a long sideways range it whipsaws across the
 * 200-day line. It lags sharp V-shaped recoveries. In a calm-but-falling market
 * it stays near full size until the slow 200-day exit fires.
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
  const cash = ctx.cash;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'close above SMA200' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200' }
  ]);

  // bearish regime: exit fully (reduceOnly so we never short)
  if (prevClose < sma200) {
    if (pos > 0) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // bullish regime: target a fraction of equity based on current volatility.
  // 3% daily ATR = 100% invested; 6% ATR = 50%; this is the vol target.
  const atrPct = atr20 / price;
  const frac = Math.min(1, 0.03 / atrPct);
  // total equity in coin terms (what we'd hold if all cash were coins) + coins held
  const totalCoins = cash / price + pos;
  const targetQty = totalCoins * frac;

  // wide deadband (20%): only rebalance when meaningfully off target, so a
  // crash (ATR doubling) triggers a sell-down but daily noise does not
  const deadband = 0.20 * targetQty;
  if (Math.abs(targetQty - pos) < deadband) return null;

  if (targetQty > pos) {
    // do not open/increase positions while the allocation engine is not healthy
    if (ctx.alloc && ctx.alloc.status !== 'ok') return null;
    const qty = Math.min(targetQty - pos, cash * 0.99 / price);
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  } else {
    const qty = pos - targetQty;
    if (qty <= 0) return null;
    return { side: 'sell', qty: qty, reduceOnly: true };
  }
}
