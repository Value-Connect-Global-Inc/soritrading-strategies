/*
 * @coinsori-strategy v1
 * name: BTC 4H Uptrend Dip-Buy
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a long-term uptrend, sharp short-term drops (RSI oversold) tend to
 * revert and the trend resumes, so buying those dips captures the bull run at better prices.
 * When it buys and sells: buys when price is in an uptrend (above the 200-bar SMA), RSI(14) is
 * oversold (<30) AND the last closed bar turned up (bounce confirmed); holds the position until
 * the trend breaks (close below the SMA) so it rides the full recovery and the subsequent rise.
 * When it does NOT work: in a choppy sideways market the SMA gate keeps flipping and dip-buys
 * can keep falling; in a straight-down crash a position bought near the top rides down until the
 * trend gate finally turns off.
 */

function onUpdate(ctx) {
  // Long-term trend gate: 200-bar SMA on 4h (~33 days of price action).
  const sma = ctx.sma(200, 1);
  const smaNow = ctx.sma(200, 0);
  if (sma == null || smaNow == null) return null;

  const price = ctx.price;
  const close = ctx.closes.at(-2);           // last CLOSED bar (identical in live and backtest)
  const closePrev = ctx.closes.at(-3);       // bar before that
  const pos = ctx.position || 0;
  const inPos = pos > 1e-9;

  const rsi = ctx.rsi(14, 1);                // closed-bar RSI
  const rsiNow = ctx.rsi(14, 0);

  // --- EXIT: trend broken (close below the 200-bar SMA) ---
  if (inPos) {
    const trendBroken = close < sma;
    const exitWatch = [
      { side: 'sell', price: sma, trigger: 'below', note: 'trend broken' }
    ];
    if (trendBroken) {
      ctx.watch(exitWatch);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch(exitWatch);
    return null;
  }

  // --- ENTRY: uptrend + oversold dip + last closed bar turned up (bounce confirmed) ---
  const uptrend = close > sma;
  const bounce = rsi != null && rsi < 30 && close > closePrev; // avoid buying a falling knife
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';
  if (uptrend && bounce && allocOk) {
    const qty = ctx.cash / price * 0.99;
    ctx.watch([{ side: 'buy', price: sma, trigger: 'below', note: 'dip bounce in uptrend',
      conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
        { label: 'last bar up', ok: close > closePrev }
      ] }]);
    return { side: 'buy', qty: qty };
  }

  // Waiting declaration when flat: short-term dip while long-term trend stays up.
  const sma50 = ctx.sma(50, 1);
  ctx.watch([{ side: 'buy', price: sma50 != null ? sma50 : sma, trigger: 'below', note: 'dip bounce in uptrend',
    conds: [
      { label: 'RSI(14) close', now: rsiNow != null ? rsiNow : rsi, op: '<', ref: 30, closed: false },
      { label: 'close > SMA200', ok: close > sma }
    ] }]);
  return null;
}
