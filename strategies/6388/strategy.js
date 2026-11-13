/*
 * @coinsori-strategy v1
 * name: BTC 4h Chandelier Trailing Stop
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a strong uptrend price tends to make higher highs. A trailing stop
 * lets winners run while a hard stop cuts losers quickly. We only enter long inside an uptrend.
 * When it buys and sells: Buy on a pullback (price touches the lower Bollinger band) while the
 * trend is up (close above the 200-EMA). Sell when price falls 3xATR below the highest close
 * since entry, or after holding 60 bars (10 days) without a new high, or when the trend flips down.
 * When it does NOT work: In choppy sideways markets the pullback entry fires often and the trailing
 * stop hands back small gains; in a fast crash the stop can gap through and the loss is worse.
 */

function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  const bb = ctx.bb(20, 2, 1);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || bb == null || bb.lower == null || atr == null) {
    ctx.watch([]);
    return null;
  }

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  const pos = ctx.position || 0;
  const st = ctx.state;

  // Chandelier exit: hold the highest close since entry, stop = peak - 3 * ATR(14).
  const atrMult = 3.0;
  // Time exit after 60 bars (10 days on 4h) — avoids sitting through a long drift.
  const maxBars = 60;

  if (pos > 0) {
    // A run may start holding (restart / deploy with position): initialise the peak then.
    if (st.peak == null) {
      st.peak = prevClose;
      st.entryBar = ctx.i;
    }
    // Update the trailing peak from the last CLOSED bar so backtest and live agree.
    if (prevClose > st.peak) st.peak = prevClose;
    const stop = st.peak - atrMult * atr;

    const watch = [{ side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' }];

    // Time exit: if the trade has drifted too long, take whatever is there.
    if (ctx.i - st.entryBar >= maxBars) {
      ctx.watch(watch);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // Regime exit: the uptrend is over, don't keep riding a falling trend.
    if (prevClose < ema200) {
      ctx.watch(watch);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }

    ctx.watch(watch);
    return null;
  }

  // Flat: enter on a pullback to the lower Bollinger band, only inside an uptrend.
  const uptrend = prevClose > ema200;
  const watch = [{
    side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower pullback',
    conds: [{ label: 'EMA200 uptrend', ok: uptrend }]
  }];

  if (uptrend && price <= bb.lower) {
    st.peak = prevClose;
    st.entryBar = ctx.i;
    const qty = (ctx.cash / price) * 0.98;
    ctx.watch(watch);
    return { side: 'buy', qty };
  }

  ctx.watch(watch);
  return null;
}
