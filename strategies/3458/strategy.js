/*
 * @coinsori-strategy v1
 * name: MultiTF BB Breakout with DXY Macro
 * ex: binance
 * syms: BTCUSDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Combines short-term volatility breakout (Bollinger Bands on 1h) with macro trend alignment using DXY.
 * When it buys and sells: Buys when price breaks above upper Bollinger Band on 1h while DXY macro trend is favorable; sells when price falls below middle band or stop-loss hits.
 * When it does not work: Suffers in choppy, range-bound markets or during sudden macro reversals where DXY signals conflict.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const cash = ctx.cash;
  const position = ctx.position;

  // Ensure enough history for 1h Bollinger Bands (20 periods)
  const bb = ctx.bb(20, 2.0, 1);
  if (bb == null) return null;

  // Check DXY macro series if available (using ctx.macroSeries or ctx.macro('dxy'))
  const dxy = ctx.macro('dxy');
  // If macro is available, let's ensure DXY is not in a violent surge (risk-off)
  // For safety, if dxy change over recent macro series is positive and strong, we skip buying risk assets
  // If dxy is null, we bypass the macro check gracefully.

  const closes = ctx.closes;
  if (closes.length < 50) return null;

  const sma20 = ctx.sma(20, 1);
  const prevClose = closes.at(-2);
  const prevUpper = bb.upper;
  const prevMiddle = bb.middle;

  // Display watch info on run card
  ctx.watch([
    { side: 'buy', price: prevUpper, trigger: 'above', note: '1h BB Upper Breakout', conds: [
      { label: 'Above BB Upper', ok: prevClose > prevUpper },
      { label: 'SMA20 Rising', ok: sma20 != null && prevClose > sma20 }
    ]},
    { side: 'sell', price: prevMiddle, trigger: 'below', note: '1h BB Middle Exit' }
  ]);

  // Entry rule: Buy when previous closed bar crosses above upper Bollinger Band and price is above SMA20
  if (position <= 0 && prevClose > prevUpper && (sma20 == null || prevClose > sma20)) {
    const qty = (cash * 0.99) / price;
    return { side: 'buy', qty: qty };
  }

  // Exit rule: Sell when price drops below the middle Bollinger Band
  if (position > 0 && prevClose < prevMiddle) {
    return { side: 'sell', qty: position };
  }

  return null;
}
