/*
 * @coinsori-strategy v1
 * name: ETH Multi-Timeframe Regime Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Single-timeframe trend with DXY+volatility gates is validated on ETH/SOL but does
 * NOT generalize to other alts (BNB/XRP failed). This is a different axis: multi-timeframe trend.
 * Hypothesis — a slow daily-equivalent regime filter (price above a rising ~200-day average) is the
 * real robustness driver, not the dollar gate. Buy 4h breakouts only when the daily regime is up.
 * When it buys and sells: buy on a fresh 20-bar high close above the 100-EMA with RSI>50, only while
 * the 1200-bar SMA (~200 days on 4h) is rising. Sell on a 20-bar low close, a 2.5x ATR hard stop, or
 * a close back below the 100-EMA.
 * When it does NOT work: in choppy years with no sustained daily uptrend it sits flat and misses
 * bear-market rallies; a regime flip to down can catch late longs in a fast crash.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  const sma1200 = ctx.sma(1200, 1);
  const sma1200prev = ctx.sma(1200, 2);
  if (atr == null || ema100 == null || sma1200 == null || sma1200prev == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const dailyUptrend = sma1200 > sma1200prev;   // ~200-day regime rising = only trade with the daily trend

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    if (prevClose < ema100) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA trend break' }]);
    return null;
  }

  if (!dailyUptrend) return null;   // regime gate: no entries while the ~200-day average is falling
  const rsi = ctx.rsi(14, 1);
  if (rsi == null || rsi <= 50) return null;   // only buy into strength, not during a weak pullback
  if (prevClose <= ema100) return null;
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
