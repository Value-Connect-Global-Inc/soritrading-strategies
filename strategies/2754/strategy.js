/*
 * @coinsori-strategy v1
 * name: Donchian Pullback Uptrend ETH 4H
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A trend-pullback family, distinct from the panic-bottom
 * mean reversion of the band-bounce champion. Instead of buying crashes below
 * the 200-SMA, it buys pullbacks to the lower Donchian channel WITHIN a
 * confirmed uptrend (price above a rising 200-SMA). Bet: in an uptrend,
 * price regularly pulls back to the lower channel then resumes — catching
 * these pullbacks participates in the melt-ups the champion misses.
 * When it buys and sells: buys when price pulls back to the lower 20-bar
 * Donchian channel while price is above the 200-SMA and the 200-SMA is
 * rising; sells when price reaches the middle Donchian channel, the 200-SMA
 * stops rising, or on a tighter 3x-ATR stop. 5-bar cooldown.
 * When it does NOT work: in a bear or choppy market below the 200-SMA it
 * sits out; in a fake uptrend the pullback keeps going and the stop catches
 * a falling knife. It whipsaws in a sideways market where the 200-SMA is
 * flat.
 *
 * 2025-01-15: display-only ctx.watch added; trading logic unchanged.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 5);
  if (sma200 == null || sma200prev == null) return null;

  // Uptrend regime: price above the 200-SMA and the 200-SMA is rising
  const uptrend = price > sma200 && sma200 > sma200prev;

  if (pos > 0) {
    const dcMid = (ctx.high(20, 1) + ctx.low(20, 1)) / 2;
    if (dcMid != null && price >= dcMid) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    if (!uptrend) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    const atr = ctx.atr(14, 1);
    // tightened from 5x to 3x ATR to cut losing dips faster in choppy markets
    if (atr != null && price <= ctx.entryPx - atr * 3) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    // Display: waiting on exit levels (mid Donchian, uptrend loss, ATR stop)
    if (dcMid != null && atr != null) {
      ctx.watch([
        { side: 'sell', price: dcMid, trigger: 'above', note: 'mid Donchian take-profit' },
        { side: 'sell', price: ctx.entryPx - atr * 3, trigger: 'below', note: '3x ATR stop' },
        { side: 'sell', price: sma200, trigger: 'below', note: 'uptrend break', conds: [{ label: 'SMA200 rising', ok: sma200 > sma200prev, closed: true }] }
      ]);
    } else {
      ctx.watch([]);
    }
    return null;
  }

  const lastExit = ctx.state.lastExit || 0;
  if (ctx.i - lastExit < 5) {
    // Display: cooldown waiting (time-based, no price)
    ctx.watch([{ side: 'buy', at: ctx.candle.ts + (5 - (ctx.i - lastExit)) * ctx.candle.interval * 1000, note: 'cooldown' }]);
    return null;
  }
  if (!uptrend) {
    // Display: waiting for uptrend regime (price-based, but not a direct order condition)
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend entry', conds: [{ label: 'SMA200 rising', ok: sma200 > sma200prev, closed: true }] }]);
    return null;
  }

  const dcLow = ctx.low(20, 1);
  if (dcLow != null && price <= dcLow * 1.01) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  // Display: waiting for pullback to lower Donchian
  if (dcLow != null) {
    ctx.watch([
      { side: 'buy', price: dcLow * 1.01, trigger: 'below', note: 'lower Donchian pullback', conds: [{ label: 'SMA200 rising', ok: sma200 > sma200prev, closed: true }] }
    ]);
  } else {
    ctx.watch([]);
  }
  return null;
}
