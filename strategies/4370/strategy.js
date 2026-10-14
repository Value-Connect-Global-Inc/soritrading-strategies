/*
 * @coinsori-strategy v1
 * name: BTC Volume-Confirmed Donchian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A Donchian breakout is only trustworthy when it happens on
 *   real volume. A 55-day high close on above-average volume is a genuine trend
 *   start; a breakout on thin volume is often a false head-fake that reverses.
 *   This bets on the first, skips the second. Volume is always available from
 *   candles, so unlike open interest this axis is fully backtestable.
 * When it buys and sells: buy when price closes above its 55-day high AND that
 *   day's volume is above its own 20-day average. Sell on a 20-day low close, a
 *   2.5x ATR hard stop, or a close back below the 100-day EMA.
 * When it does NOT work: volume confirmation is a lagging filter that can miss
 *   the very first quiet leg of a rally (the biggest gains often come before
 *   volume shows up); in a grinding bear it stays flat (safe, no upside).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || atr <= 0 || ema100 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const vol = ctx.vol;
  const avgVol = ctx.avgVol(20);
  const volOk = Number.isFinite(vol) && Number.isFinite(avgVol) && avgVol > 0 && vol > avgVol;

  const pos = ctx.pos('BTC/USDT');

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA break' }]);
    return null;
  }

  const hh55 = ctx.high(55, 2);
  if (hh55 == null) return null;
  ctx.watch([{ side: 'buy', price: hh55, trigger: 'above', note: '55-bar breakout',
               conds: [{ label: 'close > 100-EMA', ok: prevClose > ema100, closed: true },
                       { label: 'vol > 20d avg', ok: volOk, closed: true }] }]);
  if (prevClose <= hh55) return null;
  if (prevClose < ema100) return null;
  if (!volOk) return null;  // skip breakouts not backed by real volume

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.30;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
