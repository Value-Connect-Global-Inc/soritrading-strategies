/*
 * @coinsori-strategy v1
 * name: Mean-Reversion Pullback Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In a confirmed long-term uptrend (price above its 200-day
 *   SMA), a close below the lower Bollinger band with an oversold RSI marks a
 *   panic dip that tends to snap back to the mean. The Bollinger lower band
 *   adapts its "dip" definition to current volatility, so it only buys truly
 *   extreme sell-offs, not ordinary small pullbacks. Each coin runs
 *   independently and every position carries a hard 2x ATR stop.
 * When it buys and sells: buys when a coin's close is below its lower Bollinger
 *   band (20, 2) AND RSI(14) is below 30 AND the close is still above its
 *   200-day SMA. Sells on a recovery back above the middle band (20-day SMA),
 *   a hard 2x ATR stop, or a close below the 200-day SMA.
 * When it does NOT work: in a bear market it sits in cash (safe, no upside); in
 *   a violent crash RSI stays low and price keeps falling through the lower
 *   band, so the stop takes repeated losses while it is long; in a long
 *   sideways chop it whipsaws between buy and sell signals and pays fees.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (prevClose < sma200) return { side: 'sell', qty: pos };
    if (prevClose > bb.mid) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: bb.mid, trigger: 'above', note: 'recovery to mid band' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'trend broken' }]);
    return null;
  }

  const inUptrend = prevClose > ctx.sma(200, 1);
  const belowLower = prevClose < bb.lower;
  const oversold = rsi < 30;
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'lower BB dip',
               conds: [{ label: 'uptrend close>SMA200', ok: inUptrend, closed: true },
                       { label: 'RSI(14)', now: rsi, op: '<', ref: 30, closed: true }] }]);
  if (!inUptrend || !belowLower || !oversold) return null;

  // risk 2% of cash per leg, 2 ATR stop distance, cap leg at 20% of cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
