/*
 * @coinsori-strategy v1
 * name: ETH Trend Strength-Scaled Size 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the ATR-sized trend ride (risk a fixed $ per trade) has
 * great downside protection but under-deploys capital in strong bull runs —
 * a fixed $300 risk never uses the full account in a clean uptrend, which is
 * why it lags buy-and-hold in bull markets. This version scales the risk by
 * trend strength: when price is far above the 200-SMA (strong trend) it risks
 * more per trade and takes a bigger position; when price hugs the SMA (weak,
 * likely to whipsaw) it risks less. Signals and exit stay identical to the
 * proven base.
 * When it buys and sells: long on a close above the 200-SMA, sell on a close
 * below it. Position size = risk / ATR, where risk grows with how far price is
 * above the SMA (capped so we never risk more than a fixed fraction of cash).
 * When it does NOT work: same whipsaw in sideways chop; scaling risk up only
 * helps when the trend actually persists, so a strong-looking but false breakout
 * loses more than the flat-size version.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  const smaP = ctx.sma(200, 2);
  const closePrev = ctx.closes[ctx.closes.length - 2];
  const closePrev2 = ctx.closes[ctx.closes.length - 3];
  if (sma == null || smaP == null || closePrev == null || closePrev2 == null) return null;

  const price = ctx.price;
  const pos = ctx.position;

  if (pos <= 0) {
    if (closePrev2 <= smaP && closePrev > sma) {
      const atr = ctx.atr(14, 1);
      if (atr == null || atr <= 0) return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
      const distPct = (closePrev - sma) / sma;
      const risk = 300 + Math.min(Math.max(distPct * 20000, 0), 1200);
      const riskQty = risk / atr;
      const maxQty = (ctx.cash / price) * 0.98;
      return { side: 'buy', qty: Math.min(riskQty, maxQty) };
    }
    return null;
  } else {
    if (closePrev < sma) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
}
