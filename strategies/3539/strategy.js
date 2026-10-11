/*
 * @coinsori-strategy v1
 * name: ETH 4H Mean Reversion
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH swings harder than BTC, so oversold dips inside an uptrend revert to the 20-bar average more reliably and with a bigger payoff. Buying the dip is the opposite bet from breakout chasing — it enters when others are scared.
 * When it buys and sells: Buys when flat, price is above its 200-bar average (uptrend), the closed bar closes at/below the lower Bollinger band AND RSI(14) is oversold (<=30). Sells when price recovers to the 20-bar average (the mean), or after 20 bars if it has not reverted, and always has a hard stop 2 ATR below entry.
 * When it does NOT work: In a real bear market the 200-bar filter keeps it flat — safe, but it earns nothing while price falls. In a crash, "oversold" dips keep falling: the hard stop caps each loss but the win rate collapses. It needs a ranging or gently-trending market, not a violent one.
 */
function onUpdate(ctx) {
  const price = ctx.closes.at(-2);
  if (price == null) return null;
  const atr = ctx.atr(14, 1);

  // ---- exit ----
  if (ctx.position > 0) {
    if (atr == null) return null;
    // hard stop: the dip premise is wrong, cut at 2 ATR below entry
    const stopPx = ctx.entryPx - 2 * atr;
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    // time stop: mean reversion must be quick; if it has not reverted in 20 bars
    // (~3 days on 4h) the market is not mean-reverting right now — leave.
    if (ctx.state.entryBar != null && ctx.i - ctx.state.entryBar >= 20) {
      return { side: 'sell', qty: ctx.position };
    }
    // target: price recovered to the 20-bar average = the mean has been reached
    const sma20 = ctx.sma(20, 1);
    if (sma20 != null && price >= sma20) return { side: 'sell', qty: ctx.position };
    ctx.watch([
      { side: 'sell', price: sma20 != null ? sma20 : stopPx, trigger: 'above', note: 'revert to mean' },
      { side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' }
    ]);
    return null;
  }

  // ---- entry ----
  const sma200 = ctx.sma(200, 1);
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  if (sma200 == null || bb == null || rsi == null) return null;
  // only buy dips inside an uptrend (200-bar average = ~33 days on 4h)
  if (price < sma200) return null;
  // the dip must actually reach the lower band and be oversold
  if (price > bb.lower) return null;
  if (rsi > 30) return null;

  // size at 60% of cash: mean reversion has a lower win rate than trend following,
  // so we leave room for the next stop-loss instead of going all-in.
  ctx.state.entryBar = ctx.i;
  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.6 };
}
