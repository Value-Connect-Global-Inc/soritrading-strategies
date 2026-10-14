/*
 * @coinsori-strategy v1
 * name: Mean-Reversion Pullback Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In a confirmed long-term uptrend (price above its 200-day
 *   SMA), sharp pullbacks to the 20-day EMA with an oversold RSI tend to revert
 *   upward — buying the dip inside a bull market. Each coin runs independently,
 *   so a crash in one does not stop the others, and every position carries a
 *   hard 2x ATR stop so no single dip can ruin the account.
 * When it buys and sells: buys when a coin's close is below its 20-day EMA AND
 *   RSI(14) is below 35 AND the close is still above its 200-day SMA. Sells on a
 *   recovery back above the 20-day EMA, RSI rising above 55, a hard 2x ATR stop,
 *   or a close below the 200-day SMA (trend broken).
 * When it does NOT work: in a bear market it sits in cash (no upside, safe); in
 *   a violent crash RSI stays low and price keeps falling through the EMA20, so
 *   the stop takes losses repeatedly while it is long; in a sideways chop it
 *   whipsaws between buy and sell signals and pays fees.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const rsi = ctx.rsi(14, 1);
  const ema20 = ctx.ema(20, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (rsi == null || ema20 == null || sma200 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (prevClose < sma200) return { side: 'sell', qty: pos };
    if (rsi > 55 || prevClose > ema20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: ema20, trigger: 'above', note: 'recovery to EMA20' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'trend broken' }]);
    return null;
  }

  const inUptrend = prevClose > sma200;
  const pulledBack = prevClose < ema20;
  const oversold = rsi < 35;
  ctx.watch([{ side: 'buy', price: ema20, trigger: 'below', note: 'EMA20 pullback',
               conds: [{ label: 'uptrend close>SMA200', ok: inUptrend, closed: true },
                       { label: 'RSI(14)', now: rsi, op: '<', ref: 35, closed: true }] }]);
  if (!inUptrend || !pulledBack || !oversold) return null;

  // risk 2% of cash per leg, 2 ATR stop distance, cap leg at 20% of cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
