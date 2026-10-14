/*
 * @coinsori-strategy v1
 * name: Fear-Greed Dip Accumulator BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index measures crowd emotion. When it is very low
 * (extreme fear) while the long-term trend is still up, retail is panicking and BTC is
 * often on sale. It buys those panics and sells back into euphoria.
 * When it buys and sells: Buys when the index is below 30 (fear) AND price is above its
 * 200-day average (uptrend intact). Sells when the index climbs above 70 (greed), when the
 * trend breaks (price below the 200-day average), or on a hard -15% stop-loss.
 * When it does NOT work: In a long bear market the 200-day filter keeps it out entirely, so
 * it never catches the bottom; and a violent crash can still trigger the -15% stop. It also
 * stays in cash for long stretches when sentiment is neutral.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const sma200 = ctx.sma(200, 1);
  if (fg == null || sma200 == null) return null;
  const px = ctx.price;

  // ---- exit logic (only when holding) ----
  if (ctx.position > 0) {
    let reason = null;
    if (fg > 70) reason = 'greed';                 // crowd euphoric -> take profit
    else if (px < sma200) reason = 'trend-broken'; // uptrend gone, leave
    else if (ctx.entryPx != null && px < ctx.entryPx * 0.85) reason = 'stop'; // hard stop -15%
    if (reason) {
      ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'trend break exit' }]);
      ctx.log('exit', reason, 'fg', fg);
      return { side: 'sell', qty: ctx.position };
    }
    // declare the levels we are waiting on while holding
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'trend break exit' },
      { side: 'sell', price: ctx.entryPx * 0.85, trigger: 'below', note: 'hard stop -15%' }
    ]);
    return null;
  }

  // ---- entry: fear dip inside an uptrend ----
  if (fg < 30 && px > sma200) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend intact' }]);
    ctx.log('buy fg', fg, 'px', px);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.98 };
  }
  return null;
}
