/*
 * @coinsori-strategy v1
 * name: BullDipReversionBTC
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: in a bull market, sharp dips are usually buying opportunities because the
 * long-term trend reasserts itself. Buying oversold bounces ONLY while price is above the 200-day
 * average keeps us out of bear-market falling knives, where mean reversion loses badly.
 * When it buys and sells: buys when RSI(14) is oversold (<35) AND the close is above the 200-day
 * average. Sells when RSI rises above 60 (full reversion) or a 2x ATR hard stop is hit.
 * Each position risks 1% of equity via the stop.
 * When it does NOT work: in a choppy sideways market RSI dips without a real bounce and the stop is
 * hit repeatedly. In a sharp crash the dip keeps dipping and the trend filter does not save us once
 * price breaks below the 200-day average.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  if (!Number.isFinite(px) || px <= 0) return null;

  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (rsi == null || sma200 == null || atr == null || atr <= 0) return null;

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position || 0;
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (px <= hardStop || rsi > 60) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', note: 'RSI recovery', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 60, closed: true }] }]);
    return null;
  }

  // Risk 1% of equity via the 2x ATR stop, capped at 40% of equity.
  const riskPerTrade = 0.01 * ctx.cash;
  let qty = riskPerTrade / (2 * atr);
  const maxQty = (ctx.cash / px) * 0.40;
  qty = Math.min(qty, maxQty);

  // Entry: oversold AND long-term uptrend intact — buy the dip, not the knife.
  if (rsi < 35 && prevClose > sma200) return { side: 'buy', qty };
  ctx.watch([{ side: 'buy', note: 'oversold dip in uptrend',
               conds: [{ label: 'RSI(14)', now: rsi, op: '<', ref: 35, closed: true },
                       { label: 'close > 200d', ok: prevClose > sma200 }] }]);
  return null;
}
