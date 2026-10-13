/*
 * @coinsori-strategy v1
 * name: BtcHashRibbons
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Hash-ribbon logic. Miners are the marginal seller; when the 30-day hash-rate average falls below the 60-day one, miners are capitulating (selling pressure), and when it recovers above it the selling pressure ends — a leading signal for price.
 * When it buys and sells: Buys when the 30-day hash-rate average is above the 60-day one (miners back online) while price is still above its 200-day average. Sells when the 30-day average drops back below the 60-day one, price breaks its 50-day average, or a 2.5x ATR stop is hit. 15-day cooldown after exits.
 * When it does NOT work: Hash rate grows secularly, so the ribbon is bullish most of the time and adds little timing in strong bull markets; in a bear market price can keep falling even after miners stop capitulating.
 */

let h = [];
let lastExitBar = -1e9;

function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const hr = ctx.data('hashrate');
  if (hr == null) return null;
  h.push(hr);
  if (h.length > 300) h = h.slice(-300);

  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma50 == null || atr == null) return null;
  if (h.length < 61) return null;

  // MAs over the previous CLOSED bar (exclude the current bar's value)
  const closed = h.slice(0, -1);
  if (closed.length < 60) return null;
  const ma30 = closed.slice(-30).reduce((a, b) => a + b, 0) / 30;
  const ma60 = closed.slice(-60).reduce((a, b) => a + b, 0) / 60;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : prevClose;
    const stop = entry - 2.5 * atr;
    ctx.watch([
      { side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 broken' },
      { side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' }
    ]);
    if (ma30 < ma60 || prevClose < sma50 || prevClose < stop) {
      lastExitBar = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Hashrate recovery + trend' }]);
  if (ma30 > ma60 && prevClose > sma200 && (ctx.i - lastExitBar > 15)) {
    const stopDist = Math.max(2.5 * atr, prevClose * 0.03);
    const qty = (0.02 * ctx.cash) / stopDist;
    const maxQty = (ctx.cash / prevClose) * 0.98;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
