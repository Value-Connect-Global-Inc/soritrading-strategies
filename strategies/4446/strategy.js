/*
 * @coinsori-strategy v1
 * name: RSI2 Extreme-Oversold Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In crypto, very short-term selling is often exhausted —
 * when the 2-day RSI drops to an extreme oversold level the panic sellers are
 * done and price bounces. This is a classic fast mean-reversion edge, different
 * from slow Bollinger reversion (which failed): it only fires on truly extreme
 * readings. It only buys inside an uptrend so it does not catch falling knives
 * in a confirmed bear market.
 * When it buys and sells: a leg buys when the previous close's RSI(2) is below
 * 10 AND the close is above the 200-day EMA. It sells when RSI(2) climbs back
 * above 50 (mean restored), the close breaks the 200-day EMA, or a 12% hard
 * stop is hit.
 * When it does NOT work: in a strong persistent downtrend extreme oversold
 * readings repeat and the stop is hit repeatedly; and in a dead flat market it
 * rarely triggers. It misses one-way rallies because it is always waiting for a
 * panic dip.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const rsi2 = ctx.rsi(2, 1);        // RSI(2) of the last CLOSED bar
  if (rsi2 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.88;   // 12% hard stop
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };
    if (rsi2 > 50) return { side: 'sell', qty: pos };   // bounce done, mean restored
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '12% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: 'uptrend broken' },
               { side: 'sell', price: 50, trigger: 'above', note: 'RSI2 > 50',
                 conds: [{ label: 'RSI(2)', now: rsi2, op: '<', ref: 50, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  const oversold = rsi2 < 10;        // extreme panic reading
  ctx.watch([{ side: 'buy', price: 10, trigger: 'below', note: 'RSI(2) < 10',
               conds: [{ label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'RSI(2)', now: rsi2, op: '<', ref: 10, closed: true }] }]);
  if (!uptrend || !oversold) return null;

  // vol-targeted size ~2% daily vol per leg (keeps wild coins small)
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }
  const targetCash = ctx.cash * 0.33 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
