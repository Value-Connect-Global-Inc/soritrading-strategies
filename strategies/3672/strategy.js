/*
 * @coinsori-strategy v1
 * name: MultiAssetMeanRevert
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sharp drops in an established uptrend get bought back as
 * mean reversion. Opposite of the trend-following champion — it buys weakness
 * rather than strength, so the two families are not correlated.
 * When it buys and sells: buys a 25% share of equity when a coin's RSI(14) is
 * below 30 AND its close is below the lower Bollinger Band(20,2) — both read on
 * the last CLOSED bar. Sells when the close recovers above the 20-day SMA, or on
 * a hard 2x ATR stop below entry.
 * When it does NOT work: in a violent bear market, "oversold" keeps getting
 * more oversold and every dip-buy is a knife-catch — this loses badly in a
 * sustained downtrend. It also whipsaws in a flat market where RSI hovers at 30.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }
  const rsi = ctx.rsi(14, 1);        // closed bar
  const bb = ctx.bb(20, 2, 1);       // closed bar
  const sma20 = ctx.sma(20, 1);      // closed bar
  const atr = ctx.atr(14, 1);
  if (rsi == null || bb == null || sma20 == null || atr == null || atr <= 0) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const pos = ctx.pos(sym);
  const legQty = (ctx.cash / price) * 0.25; // 25% per leg, same sizing as champion

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    // Exit: mean reversion complete (close back above 20-day SMA) OR hard stop hit.
    if (prevClose > sma20 || price <= hardStop) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: sma20, trigger: 'above', note: 'reversion target' },
               { side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' }]);
    return null;
  }

  // Entry: oversold on a CLOSED bar — RSI below 30 AND close below lower BB.
  if (rsi < 30 && prevClose < bb.lower) {
    ctx.watch([]);
    return { side: 'buy', qty: legQty };
  }
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'oversold dip', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }] }]);
  return null;
}
