// 2026-04-26 표시만 바뀜, 매매 판단은 그대로
/*
 * @coinsori-strategy v1
 * name: SOL Defensive Mean Reversion
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Sharp panic sell-offs in crypto often overshoot and snap
 * back. Buying at the bottom of the Bollinger band when RSI is oversold, and
 * ONLY while price is still above the long-term 200-day average, catches the
 * rebound while staying out of real bear markets.
 * When it buys and sells: Buys when price touches the lower Bollinger band
 * (20,2) AND RSI(14) is below 40 AND price is above the 200-day average.
 * Sells when price climbs back above the 20-day average, or immediately if
 * price falls below the 200-day average.
 * When it does NOT work: In a genuine long bear market the trend gate keeps it
 * in cash (no return), and in a melt-up the oversold entries are rare so it
 * lags holding the asset the whole way up.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const r = ctx.rsi(14, 1);
  const ma200 = ctx.sma(200, 1);
  const ema20 = ctx.ema(20, 1);
  if (bb == null || r == null || ma200 == null || ema20 == null) {
    ctx.watch([]);
    return null;
  }

  const px = ctx.price;
  const prevClose = ctx.closes[ctx.closes.length - 2];
  if (prevClose == null) {
    ctx.watch([]);
    return null;
  }

  if (ctx.position === 0) {
    // oversold at the bottom band, but only while above the long-term trend
    ctx.watch([{
      side: 'buy',
      price: bb.lower,
      trigger: 'below',
      note: 'BB lower touch',
      conds: [
        { label: 'Close <= BB lower', now: prevClose, op: '<=', ref: bb.lower, closed: true },
        { label: 'RSI(14) close', now: r, op: '<', ref: 40, closed: true },
        { label: 'Close > SMA200', ok: prevClose > ma200, closed: true }
      ]
    }]);
    if (prevClose > ma200 && prevClose <= bb.lower && r < 40) {
      return { side: 'buy', qty: ctx.cash / px * 0.98 };
    }
    return null;
  }

  ctx.watch([
    {
      side: 'sell',
      price: ma200,
      trigger: 'below',
      note: 'hard stop below SMA200',
      conds: [{ label: 'Close < SMA200', now: prevClose, op: '<', ref: ma200, closed: true }]
    },
    {
      side: 'sell',
      price: ema20,
      trigger: 'above',
      note: 'exit above EMA20',
      conds: [{ label: 'Close > EMA20', now: prevClose, op: '>', ref: ema20, closed: true }]
    }
  ]);

  // hard stop: below the 200-day average, get out fast
  if (prevClose < ma200) {
    return { side: 'sell', qty: ctx.position };
  }
  // normal exit: price recovered back above the 20-day average
  if (prevClose > ema20) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
