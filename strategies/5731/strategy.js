/*
 * @coinsori-strategy v1
 * name: DIAG Donchian channel probe 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic only: prints what ctx.highs, ctx.lows, ctx.high() and ctx.low()
 * actually return, so we can see why the Donchian channel never fires a trade.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr20 = ctx.atr(20, 1);
  if (atr20 == null) return null;

  if (ctx.i < 5) {
    ctx.log('i=' + ctx.i +
      ' closesLen=' + (ctx.closes ? ctx.closes.length : 'null') +
      ' highsLen=' + (ctx.highs ? ctx.highs.length : 'null') +
      ' lowsLen=' + (ctx.lows ? ctx.lows.length : 'null') +
      ' high55=' + ctx.high(55, 1) +
      ' low30=' + ctx.low(30, 1) +
      ' maxSlice=' + (ctx.highs ? Math.max(...ctx.highs.slice(-56, -1)) : 'n/a'));
  }

  const sma20 = ctx.sma(20, 1);
  if (sma20 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    if (prevClose < sma20) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;
  if (prevClose > sma20) {
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct);
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
