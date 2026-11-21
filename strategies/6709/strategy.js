/*
 * @coinsori-strategy v1
 * name: BTC Donchian Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin moves in long trends; a close above the highest high
 * of the last ~9 days (55 x 4h bars) signals the start of a new up-trend.
 * When it buys and sells: we buy on a breakout above that high, but only while
 * price stays above its 200-bar trend line (~33 days) so we do not buy into a
 * downtrend; we sell when price closes below a trailing stop (the higher of the
 * 20-bar low and 3 ATR below our entry).
 * When it does NOT work: in long sideways chop, false breakouts still get stopped
 * out and fees pile up without a real trend to pay for them.
 */
function onUpdate(ctx) {
  const dHigh = ctx.high(55, 2);   // breakout level: highest high of the 55 bars BEFORE the last closed bar
  const dLow  = ctx.low(20, 2);    // exit floor: lowest low of the 20 bars BEFORE the last closed bar
  const atr   = ctx.atr(14, 1);    // current volatility (through the last closed bar), for the stop distance
  const trend = ctx.sma(200, 1);   // long-term trend filter (~33 days on 4h bars)
  if (dHigh == null || dLow == null || atr == null || trend == null) {
    ctx.watch([]);
    return null;
  }
  const prevClose = ctx.closes.at(-2);   // last CLOSED bar close (same in backtest and live)
  if (prevClose == null) {
    ctx.watch([]);
    return null;
  }

  if (ctx.position <= 0) {
    // Entry: close above prior 55-bar high AND above the 200-bar trend line
    ctx.watch([{ side: 'buy', price: dHigh, trigger: 'above', note: 'Donchian 55 breakout',
      conds: [{ label: 'Close > SMA200', ok: prevClose > trend }] }]);
    if (prevClose > dHigh && prevClose > trend) {
      const qty = (ctx.cash / ctx.price) * 0.98;
      if (qty <= 0) return null;
      return { side: 'buy', qty: qty };
    }
    return null;
  }

  // Exit: trailing stop = higher of the 20-bar low and 3 ATR below entry
  const stop = Math.max(dLow, ctx.entryPx != null ? ctx.entryPx - 3 * atr : dLow);
  ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR trailing stop' }]);
  if (prevClose < stop) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
