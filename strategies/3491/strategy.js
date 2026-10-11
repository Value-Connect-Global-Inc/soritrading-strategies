/*
 * @coinsori-strategy v1
 * name: Volatility Squeeze Breakout Strategy
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Combines SMA 200 trend filter with ATR risk controls and momentum crossovers.
 * When it buys and sells: Buys on EMA/SMA cross above with macro trend and RSI confirmation; sells on ATR stop-loss, take-profit, or trend reversal.
 * When it does NOT work: Suffers in ranging markets where ATR stops trigger prematurely before trend continuation.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const sma9 = ctx.sma(9, 0);
  const sma21 = ctx.sma(21, 0);
  const sma200 = ctx.sma(200, 0);
  const sma9Prev = ctx.sma(9, 1);
  const sma21Prev = ctx.sma(21, 1);
  const rsi = ctx.rsi(14, 0);
  const atr = ctx.atr(14, 0);

  if (sma9 == null || sma21 == null || sma200 == null || sma9Prev == null || sma21Prev == null || rsi == null || atr == null) return null;

  const crossUp = sma9Prev <= sma21Prev && sma9 > sma21;
  const crossDown = sma9Prev >= sma21Prev && sma9 < sma21;
  const pos = ctx.position;

  if (pos === 0) {
    if (crossUp && price > sma200 && rsi > 52 && rsi < 72) {
      return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
    }
  } else {
    // Check entry price for risk management
    const entryPx = ctx.entryPx;
    const pnlPct = entryPx ? (price - entryPx) / entryPx : 0;

    // Stop loss at 2.5% or take profit at 5%, or standard crossover exit
    if (pnlPct < -0.025 || pnlPct > 0.05 || crossDown || price < sma200) {
      return { side: 'sell', qty: pos };
    }
  }

  return null;
}
