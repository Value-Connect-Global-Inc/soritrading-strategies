/*
 * @coinsori-strategy v1
 * name: Fear-Sized Band-Bounce BTC 4H
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * 2025-01-01: display only changed, trading logic unchanged.
 * Why this strategy: The validated cross-asset champion: buy panic-bottoms
 * below the lower Bollinger band with RSI<30 in an uptrend (price above the
 * 200-SMA), and scale position size down when the fear-greed index shows deep
 * fear (a panic that may keep falling). Deep fear means the bounce is less
 * reliable, so we risk less; moderate dips get the full size. Validated as the
 * strongest recipe across many cycles on BTC/ETH/SOL.
 * When it buys and sells: buys when price closes below the lower Bollinger(20,2)
 * with RSI<30, above the 200-SMA. Position size is 50% when fear-greed<10, 70%
 * when <20, else 95%. Sells at the middle band, RSI>50, or a 6-ATR stop; 5-bar
 * cooldown.
 * When it does NOT work: lags strong melt-ups (never buys without a dip, so it
 * misses most of a bull run). A panic that keeps falling still loses despite the
 * stop. Never buys below the 200-SMA, so it sits out entire bear markets (its
 * main protection). If fear-greed data is missing it falls back to 95% size.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (bb == null || rsi == null || sma200 == null) return null;

  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    const stopPx = (atr != null && ctx.entryPx != null) ? ctx.entryPx - atr * 6 : null;
    // Watch exit conditions: middle band, RSI>50, or 6-ATR stop
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'middle band', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 50, closed: true }] },
      { side: 'sell', price: stopPx, trigger: 'below', note: '6-ATR stop', conds: [{ label: 'ATR(14) close', now: atr, op: '>', ref: 0, closed: true }] }
    ].filter(w => w.price != null));
    if (price >= bb.mid || rsi > 50) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    if (atr != null && ctx.entryPx != null && price <= ctx.entryPx - atr * 6) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const lastExit = ctx.state.lastExit || 0;
  if (ctx.i - lastExit < 5) {
    // In cooldown, watch for when it ends
    ctx.watch([{ side: 'buy', at: ctx.candle.ts + (5 - (ctx.i - lastExit)) * ctx.candle.interval * 1000, note: 'cooldown end' }]);
    return null;
  }
  if (price < sma200) {
    // Below 200-SMA, no entry until above
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: '200-SMA reclaim' }]);
    return null;
  }
  if (!(price < bb.lower && rsi < 30)) {
    // Not at panic bottom yet
    ctx.watch([
      { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: '200-SMA hold', ok: price >= sma200 }] }
    ]);
    return null;
  }

  // Two-tier fear-depth sizing: deep fear = smaller position (bounce less
  // reliable). Fall back to 95% if fear-greed data is missing.
  const fg = ctx.data('fear_greed');
  let frac = 0.95;
  if (fg != null) {
    if (fg < 10) frac = 0.50;
    else if (fg < 20) frac = 0.70;
  }

  // Entry condition met, watch the entry (though it will execute now)
  ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'panic bottom entry', conds: [{ label: 'BB lower', now: bb.lower, op: '>', ref: price, closed: true }, { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: '200-SMA hold', ok: price >= sma200 }, { label: 'fear-greed', now: fg, op: '<', ref: 20 }] }]);

  ctx.state.lastExit = ctx.i;
  return { side: 'buy', qty: ctx.cash / ctx.price * frac };
}
