/*
 * @coinsori-strategy v1
 * name: VolTarget Donchian Multi-Asset Basket
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the single-asset VolTarget Donchian 55/20 (validated) is
 * defensive but concentrated in BTC, so one coin's bad window drags the whole
 * account. Running the same proven rule on four coins spreads that risk: in any
 * given window at least one coin is usually trending, and vol-targeting shrinks
 * each leg exactly when that coin gets wild.
 * When it buys and sells: per asset, buy on a 55-day high breakout, exit on the
 * 20-day low or a 2xATR stop, size each leg to a 2% daily-vol target.
 * When it does NOT work: in a broad risk-off where ALL coins fall together
 * (2022), the basket still loses — diversification does not remove crash risk,
 * only single-coin concentration. It also lags a straight bull because
 * vol-targeting caps each leg's exposure.
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
  const atrPct = atr / price;
  const targetVol = 0.02; // 2% expected daily vol on the account per leg
  const size = Math.min(1, targetVol / atrPct);
  const equity = ctx.cash + pos * price;
  const targetQty = (equity * size * 0.95) / price;

  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      const stopPx = entry - 2 * atr; // hard stop caps single-position loss
      if (price <= stopPx) return { side: 'sell', qty: pos };
      if (price < ll) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop: 2xATR' },
                 { side: 'sell', price: ll, trigger: 'below', note: 'exit: 20d low' }]);
    } else {
      if (price < ll) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: ll, trigger: 'below', note: 'exit: 20d low' }]);
    }
    // Rebalance only on >15% drift to avoid churn from tiny ATR wobbles.
    const diff = targetQty - pos;
    if (Math.abs(diff) / Math.max(pos, 1e-9) > 0.15) {
      return { side: diff > 0 ? 'buy' : 'sell', qty: Math.abs(diff) };
    }
    return null;
  }

  if (price > hh && targetQty > 0) {
    ctx.watch([{ side: 'buy', price: hh, trigger: 'above', note: 'enter: 55d high' }]);
    return { side: 'buy', qty: targetQty };
  }
  ctx.watch([{ side: 'buy', price: hh, trigger: 'above', note: 'enter: 55d high' }]);
  return null;
}
