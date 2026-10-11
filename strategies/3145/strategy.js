/*
 * @coinsori-strategy v1
 * name: ETH 1D Defensive Donchian
 * ex: binance
 * syms: ETHUSDT
 * interval: 1d
 * cash: 10000
 * 2026-05-09 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: The Donchian 55/30 breakout recipe that worked on ADA 1d
 * was found to generalize to ETH 1d when made defensive: block entries while
 * the long-term trend is still falling (steep-downtrend filter) and cap the
 * loss with a 3x ATR stop. This avoids the deep-bear breakouts that cause the
 * worst drawdowns in plain trend-following.
 * When it buys and sells: buys when the daily close breaks above the 55-day
 * high AND the 200-day average is not falling (SMA200 now >= SMA200 20 bars
 * ago). Sells when the close breaks below the 30-day low OR the price falls
 * 3x ATR below the entry price (protective stop).
 * When it does NOT work: sideways chop whipsaws the breakout, the ATR stop can
 * exit right before a rebound, and the trend gate can miss the very start of a
 * recovery that begins while the 200-day average is still falling. Lags
 * buy-and-hold in straight melt-ups.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const hi55 = ctx.high(55, 1);
  const lo30 = ctx.low(30, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200_20ago = ctx.sma(200, 21);
  const atr = ctx.atr(14);
  if (hi55 == null || lo30 == null || sma200 == null || sma200_20ago == null || atr == null) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 3 * atr;
    const watch = [{ side: 'sell', price: lo30, trigger: 'below', note: '30d low exit' }];
    if (stopPx > 0) watch.push({ side: 'sell', price: stopPx, trigger: 'below', note: '3 ATR stop' });
    ctx.watch(watch);

    if (price < lo30 || (stopPx > 0 && price < stopPx)) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Block entries only while the long-term trend is still falling (steep-downtrend filter)
  const trendFalling = sma200 < sma200_20ago;
  ctx.watch([{
    side: 'buy',
    price: hi55,
    trigger: 'above',
    note: '55d high breakout',
    conds: [{ label: 'SMA200 not falling', now: sma200, op: '>=', ref: sma200_20ago, closed: true }]
  }]);

  if (price > hi55 && !trendFalling) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
