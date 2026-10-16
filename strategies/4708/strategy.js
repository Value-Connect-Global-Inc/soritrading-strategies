/*
 * @coinsori-strategy v1
 * name: BTC Chandelier Trend Rider 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Trend following on BTC 1d is a proven family, but the channel-breakdown exit
 * (e.g. 20- or 55-bar low) gives back a fixed amount of profit that does not adapt to volatility.
 * A chandelier stop trails 3x ATR below the highest close since entry: it rides trends far in calm
 * markets and cuts losses early in volatile ones, so it adapts to the market's own speed.
 * When it buys and sells: buys when a closed daily bar closes above the 100-day EMA while the EMA
 * is rising (uptrend). Sells when price falls below the chandelier level (highest close since entry
 * minus 3x ATR) or below the 100-day EMA. Position is scaled down when volatility is high.
 * When it does NOT work: in a choppy sideways market the EMA gate whipsaws and each entry is
 * stopped out by the trailing stop (death by a thousand cuts). It also lags the first leg of a
 * sharp reversal because the trailing stop needs price to fall far enough to trigger.
 */
let peakSinceEntry = null; // highest close since the current entry (reset when flat)

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 220) return null; // need 100-bar EMA + margin

  const ema100 = ctx.ema(100, 1);
  const ema100Prev = ctx.ema(100, 2);
  if (ema100 == null || ema100Prev == null) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const prevClose = c.at(-2); // last CLOSED bar
  const pos = ctx.position;

  if (pos > 0) {
    // update the trailing peak with the last closed bar
    if (peakSinceEntry == null || prevClose > peakSinceEntry) peakSinceEntry = prevClose;
    const chand = peakSinceEntry - atr * 3; // 3x ATR trailing stop
    if (price <= chand) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: chand, trigger: 'below', note: '3x ATR chandelier' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100d EMA breakdown' }]);
    return null;
  }

  // flat: reset the trailing peak so a new entry starts fresh
  peakSinceEntry = null;

  const trendUp = ema100 > ema100Prev && prevClose > ema100;
  if (!trendUp) {
    ctx.watch([{ side: 'buy', price: ema100, trigger: 'above', note: '100d EMA reclaim' }]);
    return null;
  }

  // ATR-scaled sizing: cut exposure when volatility is high (target 2% of price per ATR)
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.02 / atrPct);
  const qty = (ctx.cash * 0.95 * volScale) / price * 0.95;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: ema100, trigger: 'above', note: '100d EMA reclaim' }]);
  return { side: 'buy', qty };
}
