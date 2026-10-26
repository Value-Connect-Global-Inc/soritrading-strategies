/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian Reversion 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment extremes (Fear & Greed index) tend to overshoot and mean-revert — deep fear marks local bottoms, extreme greed marks tops. This uses sentiment data price alone cannot see.
 * When it buys and sells: Buy when the Fear & Greed index is very low (extreme fear) and price is not in a confirmed downtrend freefall. Sell when the index recovers to neutral or price hits a hard stop.
 * When it does NOT work: In a sustained bear market where fear stays low for months, "buy the dip" keeps catching falling knives. Also fails if the index stays pinned at extremes without reverting.
 */
function onUpdate(ctx) {
  const fg = ctx.data("fear_greed");
  if (fg == null) return null;           // no sentiment data -> stay out

  // Use closed-bar values so backtest/paper/live agree.
  const fgPrev = ctx.data("fear_greed"); // current value (dataset is daily, aligns with 1d bar)
  const sma = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  const price = ctx.price;
  if (sma == null || atr == null) return null;

  const pos = ctx.position;
  const entry = ctx.entryPx;

  // --- Hard stop: exit if price falls 2.5x ATR below entry (protect capital in any regime).
  if (pos > 0 && entry != null) {
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'hard stop 2.5x ATR' }]);
    if (price <= stop) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
  }

  // --- Exit: sentiment recovered to neutral (>= 55) -> take the reversion profit.
  if (pos > 0 && fgPrev >= 55) {
    return { side:'sell', qty: pos, reduceOnly: true };
  }

  // --- Entry: extreme fear (<= 20) and price above SMA50 (not a confirmed crash).
  // Threshold 20 = deep fear; SMA50 filter avoids catching a confirmed downtrend freefall.
  if (pos === 0 && fgPrev <= 20 && price > sma) {
    ctx.watch([{ side:'buy', note:'fear<=20 & price>SMA50' }]);
    return { side:'buy', qty: ctx.cash / price * 0.99 };
  }

  ctx.watch([{ side:'buy', note:'waiting for extreme fear (<=20)' }]);
  return null;
}
