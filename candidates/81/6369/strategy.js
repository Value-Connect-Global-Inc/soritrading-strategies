/*
 * @coinsori-strategy v1
 * name: Volume-ATR Confirmed Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: strong directional moves that arrive with above-average volume and expanding volatility tend to continue, while quiet low-volume moves are more often noise.
 * When it buys and sells: it buys when price is in an uptrend and a fresh EMA20/50 crossover arrives together with above-average volume and expanding ATR; it sells when price closes back below the fast EMA or hits a hard ATR stop.
 * When it does NOT work: in choppy sideways markets (false crossovers) and during low-volume grind-ups where the volume gate keeps it out and it misses the move.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;

  // All decision values come from CLOSED bars (ago>=1) so backtest/paper/live agree.
  const prevClose = ctx.closes.at(-2);
  const sma100 = ctx.sma(100, 1);
  const ema20 = ctx.ema(20, 1);
  const ema20Prev = ctx.ema(20, 2);
  const ema50 = ctx.ema(50, 1);
  const ema50Prev = ctx.ema(50, 2);
  const atr14 = ctx.atr(14, 1);
  const atr14old = ctx.atr(14, 20);
  const volPrev = ctx.volPrev;
  const avgVol50 = ctx.avgVol(50);

  if (prevClose == null || sma100 == null || ema20 == null || ema20Prev == null ||
      ema50 == null || ema50Prev == null || atr14 == null || atr14old == null ||
      volPrev == null || avgVol50 == null) return null;

  if (pos > 0) {
    // Hard stop: 2.5 ATR below entry, caps worst-case loss to ~6-8% per trade.
    const hardStop = ctx.entryPx != null ? ctx.entryPx - 2.5 * atr14 : null;
    const watchList = [
      { side: 'sell', price: ema20, trigger: 'below', note: 'EMA20 trailing exit' }
    ];
    if (hardStop != null) {
      watchList.push({ side: 'sell', price: hardStop, trigger: 'below', note: 'ATR hard stop' });
      if (price <= hardStop) {
        return { side: 'sell', qty: pos, reduceOnly: true };
      }
    }
    // Trailing exit: last closed bar closes back below the fast EMA.
    if (prevClose < ema20) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch(watchList);
    return null;
  }

  const uptrend = prevClose > sma100;              // price above the 100-bar trend line
  const crossUp = ema20Prev <= ema50Prev && ema20 > ema50; // fresh EMA20/50 crossover
  const volOk = volPrev > avgVol50 * 1.2;          // volume clearly above its 50-bar average
  const atrOk = atr14 > atr14old;                  // volatility expanding vs 20 bars ago

  ctx.watch([
    { side: 'buy', price: ema50, trigger: 'above', note: 'EMA cross zone', conds: [
      { label: 'uptrend > SMA100', ok: uptrend },
      { label: 'EMA20>EMA50 cross', ok: crossUp },
      { label: 'volume > 1.2x avg', ok: volOk },
      { label: 'ATR expanding', ok: atrOk }
    ]}
  ]);

  if (uptrend && crossUp && volOk && atrOk) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
