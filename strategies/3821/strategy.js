/*
 * @coinsori-strategy v1
 * name: BtcFedRegime
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's big moves are driven by liquidity. When the Fed is cutting rates or rates are near zero, money flows into risk assets; when rates rise, money leaves. This strategy only buys BTC when the monetary regime is supportive.
 * When it buys and sells: Buys when price is above its 200-day average AND the fed funds rate is falling (or near zero), with a 15-day cooldown after each exit to avoid whipsaw. Sells when price drops below its 50-day average, a hard stop (2x ATR below entry) is hit, or money turns tight while price is below the 200-day average.
 * When it does NOT work: It sits in cash during flat-rate periods, so it misses rallies that happen while rates are steady. In a strong bull market with steady low rates it can exit early on the 50-day rule and underperform buy-and-hold.
 */

let lastExitBar = -1e9; // module-level: bar index of last exit (persists across bars in a run)

function onUpdate(ctx) {
  const pos = ctx.position;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma50 == null || atr == null) return null;

  const fed = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  if (fed == null || fedLag == null) return null;

  // Easing = rates falling, OR rates already near zero (maximally easy money)
  const easing = fed < fedLag || fed < 0.5;

  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : prevClose;
    const stop = entry - 2 * atr;
    ctx.watch([
      { side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 broken' },
      { side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' }
    ]);
    // Exit: short trend broken, hard stop, or tight money while below the long trend
    if (prevClose < sma50 || prevClose < stop || (!easing && prevClose < sma200)) {
      lastExitBar = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 reclaim' }]);
  if (easing && prevClose > sma200 && (ctx.i - lastExitBar > 15)) {
    // Risk 2% of account per trade; stop distance = 2x ATR (min 2% of price)
    const stopDist = Math.max(2 * atr, prevClose * 0.02);
    const qty = (0.02 * ctx.cash) / stopDist;
    const maxQty = (ctx.cash / prevClose) * 0.98;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
