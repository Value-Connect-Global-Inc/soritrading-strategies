/*
 * @coinsori-strategy v1
 * name: Donchian 55/20 Trend BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto trends hard but crashes violently. A slow Donchian
 * 55-day breakout only enters after a sustained up-move (fewer whipsaws than a
 * fast breakout), a 20-day low exit gets out of downtrends, and a 2xATR hard
 * stop protects the account. Full position when in trend.
 * When it buys and sells: buys when price breaks the 55-day high, exits on the
 * 20-day low break or a 2xATR stop.
 * When it does NOT work: in a long sideways range the 55/20 breakout whipsaws;
 * a gap down can hit the stop before the exit reacts. It lags buy-and-hold in a
 * straight-line bull because the slow 55-day entry waits for a big move first.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // 55-day high / 20-day low from CLOSED bars so backtest == live.
  const hh = ctx.high(55, 1);
  const ll = ctx.low(20, 1);
  if (hh == null || ll == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 2xATR hard stop: caps the loss on any single position.
      const stopPx = entry - 2 * atr;
      if (price <= stopPx) return { side: 'sell', qty: pos };
      if (price < ll) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop: 2xATR' },
                 { side: 'sell', price: ll, trigger: 'below', note: 'exit: 20d low' }]);
    } else {
      if (price < ll) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: ll, trigger: 'below', note: 'exit: 20d low' }]);
    }
    return null;
  }

  if (price > hh) {
    const qty = (ctx.cash * 0.95) / price;
    ctx.watch([{ side: 'buy', price: hh, trigger: 'above', note: 'enter: 55d high' }]);
    return { side: 'buy', qty };
  }

  ctx.watch([{ side: 'buy', price: hh, trigger: 'above', note: 'enter: 55d high' }]);
  return null;
}
