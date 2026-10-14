/*
 * @coinsori-strategy v1
 * name: 4H Keltner MR Basket
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a confirmed uptrend (price above its 200-period SMA),
 *   sharp pullbacks to the Keltner lower band (EMA20 - 2.5x ATR) with an
 *   oversold RSI are temporary dips that mean-revert back to the EMA. This is
 *   the opposite bet to the 1d Donchian breakout champion: it buys dips in
 *   trends instead of chasing breakouts, and it exits quickly at the mean so
 *   it holds far less overnight risk. The ledger already showed this recipe
 *   promising on a 5-asset basket (+44%, MDD 5.5%).
 * When it buys and sells: buy when price closes below EMA20 - 2.5x ATR and RSI
 *   is below 40 while price is above the 200-SMA. Sell when price closes back
 *   at/above EMA20 (the dip has filled), or on a 2.5x ATR hard stop.
 * When it does NOT work: in a strong one-way rally there are no dips to buy and
 *   it sits in cash (misses the melt-up); in a chop below the 200-SMA the trend
 *   gate keeps it flat (safe, no upside). It is a small-edge, high-frequency
 *   strategy, so fees matter more than for the 1d champion.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema20 = ctx.ema(20, 1);
  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  if (atr == null || atr <= 0 || ema20 == null || sma200 == null || rsi == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (prevClose >= ema20) return { side: 'sell', qty: pos };  // dip filled, take the mean
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema20, trigger: 'above', note: 'back to EMA20' }]);
    return null;
  }

  const lower = ema20 - 2.5 * atr;
  ctx.watch([{ side: 'buy', price: lower, trigger: 'below', note: 'Keltner lower touch',
               conds: [{ label: 'RSI(14) < 40', now: rsi, op: '<', ref: 40, closed: true },
                       { label: 'close > SMA200', ok: prevClose > sma200, closed: true }] }]);
  if (prevClose >= lower) return null;
  if (rsi >= 40) return null;
  if (prevClose <= sma200) return null;  // only buy dips inside an uptrend

  const riskCash = ctx.cash * 0.01;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20;  // cap each leg at 20% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
