/*
 * @coinsori-strategy v1
 * name: SOL Trend-Pullback Dip Buy 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the validated champion family (ETH/SOL DXY+vol gate breakout trend)
 * enters on NEW highs. This tests a different entry inside the SAME winning regime: buy
 * shallow pullbacks in a confirmed uptrend instead of breakouts. In a strong uptrend,
 * a dip back to the 20-EMA that stays above the 100-EMA is a re-entry point for the
 * trend, not a reversal. Different from both the champion (breakout entry) and the failed
 * deep-dip MR (RSI<30 capitulation): this buys mild weakness and rides the trend out.
 * When it buys and sells: buy when price is above a rising 200-SMA (uptrend regime) AND
 * the last close is below the 20-EMA (pulled back) but still above the 100-EMA (trend
 * intact), with RSI below 55 (not overbought). Sell on a 2.5x ATR hard stop or a close
 * back below the 100-EMA (trend broken).
 * When it does NOT work: in a bear market the rising-200-SMA gate keeps it flat; in a
 * choppy range above the 200-SMA it buys dips that keep dipping and hits the stop; a
 * violent crash through the 100-EMA exits at the stop, not at the trend break.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }
  const sma200 = ctx.sma(200, 1);
  const sma200ago20 = ctx.sma(200, 21);   // slope of the 200-SMA over the last 20 bars
  const ema20 = ctx.ema(20, 1);
  const ema100 = ctx.ema(100, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  if (sma200 == null || sma200ago20 == null || ema20 == null || ema100 == null || atr == null || atr <= 0 || rsi == null) {
    ctx.watch([]); return null;
  }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  // Uptrend regime, same gate as the validated champion: price above a 200-SMA that rose
  // >0.05% over 20 bars. Below that drift the SMA is flat and dips whipsaw.
  const slopePct = (sma200 / sma200ago20 - 1) * 100;
  const uptrend = prevClose > sma200 && slopePct > 0.05;

  const pos = ctx.position;
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) { ctx.watch([]); return { side: 'sell', qty: pos }; }
    if (prevClose < ema100) { ctx.watch([]); return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA trend break' }]);
    return null;
  }

  // Pullback entry: uptrend regime + last close below the 20-EMA (dip) but above the
  // 100-EMA (trend intact) + RSI below 55 (mild weakness, not a blow-off top).
  const pullback = uptrend && prevClose < ema20 && prevClose > ema100 && rsi < 55;
  if (!pullback) { ctx.watch([]); return null; }

  const riskCash = 0.01 * ctx.cash;        // risk 1% of equity via the 2.5x ATR stop
  let qty = riskCash / (2.5 * atr);
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) { ctx.watch([]); return null; }
  ctx.watch([{ side: 'buy', conds: [{ label: 'close < EMA20', ok: prevClose < ema20 },
                                    { label: 'close > EMA100', ok: prevClose > ema100 },
                                    { label: 'RSI(14) close', now: rsi, op: '<', ref: 55, closed: true }],
              note: 'pullback in uptrend' }]);
  return { side: 'buy', qty };
}
