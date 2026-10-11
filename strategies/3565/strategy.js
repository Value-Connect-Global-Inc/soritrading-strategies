/*
 * @coinsori-strategy v1
 * name: ETH Fear-Greed Regime Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto is sentiment-driven. Historically, buying extreme fear (fear-greed index low) inside an uptrend gives good entries, and selling extreme greed captures the move.
 * When it buys and sells: Buys when price is above the 200-bar trend line AND the fear-greed index is in the fear zone (<=35) AND RSI(14) is oversold (<=32). Sells when the index reaches greed (>=70), RSI gets overbought (>=70), the trend line breaks, or a hard 2*ATR stop is hit.
 * When it does NOT work: In a strong downtrend the trend guard keeps it out (safe), but it misses rallies that start from neutral sentiment. Choppy sideways markets with fear readings cause small repeated losses. Extreme fear can persist and price keeps falling until the stop triggers.
 */
function onUpdate(ctx) {
  // --- regime guard: long-term trend ---
  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // sentiment gate (external fear-greed dataset)
  const fg = ctx.data('fg');
  if (fg == null) return null;

  const pos = ctx.position;
  const atr = ctx.atr(14, 1);

  // --- exit management ---
  if (pos > 0) {
    if (atr != null && ctx.price < ctx.entryPx - 2 * atr) {
      return { side: 'sell', qty: pos };   // hard stop: 2*ATR risk
    }
    if (fg >= 70) {
      return { side: 'sell', qty: pos };   // extreme greed = take profit
    }
    const rsi = ctx.rsi(14, 1);
    if (rsi != null && rsi >= 70) {
      return { side: 'sell', qty: pos };   // overbought exit
    }
    if (prevClose < ema200) {
      return { side: 'sell', qty: pos };   // trend broke
    }
    return null;
  }

  // --- entry: contrarian within uptrend ---
  if (prevClose < ema200) return null;   // never buy a downtrend
  if (fg > 35) return null;              // buy only fear zone (<=35)
  if (atr == null || atr <= 0) return null;
  const rsi = ctx.rsi(14, 1);
  if (rsi == null || rsi > 32) return null;   // buy only oversold

  // risk-size so a full 2*ATR stop loses ~1% of equity
  const riskCash = ctx.cash * 0.01;
  const qty = riskCash / (2 * atr);
  return { side: 'buy', qty: qty };
}
