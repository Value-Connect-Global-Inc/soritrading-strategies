/*
 * @coinsori-strategy v1
 * name: Multi-Asset Contrarian Reversion 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Mean reversion, the opposite family of the Donchian
 *   champion. In a confirmed uptrend (close above its 200-day SMA) crypto
 *   dips are usually buying opportunities; a deep oversold close (RSI below 30
 *   and close below the lower Bollinger band) marks such a dip. Each coin runs
 *   its own reversion with a hard 2.5x ATR stop and is sized to 20% of cash.
 * When it buys and sells: buy a coin when it closes deeply oversold while
 *   above its 200-day SMA; sell when it recovers (RSI above 55 or close back
 *   above the Bollinger mid) or on the hard stop.
 * When it does NOT work: in a bull market that is actually rolling over, the
 *   SMA200 still says "uptrend" while every dip keeps falling — this catches
 *   falling knives. It also sits in cash during long bear markets and during
 *   straight-line melt-ups with no dips, so it underperforms buy-and-hold in
 *   strong rallies.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    const rsi = ctx.rsi(14, 1);
    const bb = ctx.bb(20, 2, 1);
    const hardStop = ctx.entryPx - 2.5 * atr;
    const watch = [{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' }];
    if (rsi != null) watch.push({ side: 'sell', price: rsi, trigger: 'above', note: 'RSI>55 recovery' });
    if (bb != null) watch.push({ side: 'sell', price: bb.mid, trigger: 'above', note: 'BB mid recovery' });
    ctx.watch(watch);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (rsi != null && rsi > 55) return { side: 'sell', qty: pos };
    if (bb != null && prevClose > bb.mid) return { side: 'sell', qty: pos };
    return null;
  }

  // regime filter: only mean-revert inside a confirmed uptrend
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  if (prevClose <= sma200) return null;

  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  if (rsi == null || bb == null) return null;

  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower oversold',
               conds: [{ label: 'RSI(14) < 30', now: rsi, op: '<', ref: 30, closed: true },
                       { label: 'close > SMA200', ok: prevClose > sma200, closed: true }] }]);

  if (rsi >= 30) return null;          // not oversold enough
  if (prevClose >= bb.lower) return null; // not below the lower band
  if (prevClose <= sma200) return null;   // regime check on the same closed bar

  const riskCash = ctx.cash * 0.02;      // risk 2% of cash per leg on the stop
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20; // cap each leg at 20% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
