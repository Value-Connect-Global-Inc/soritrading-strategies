/*
 * @coinsori-strategy v1
 * name: BTC 4H Donchian Turtle Defensive Exits
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Bet on sustained 4h uptrends in BTC: enter only on a clean 55-bar breakout in
 * an uptrend (fewer, higher-quality entries than fast momentum signals), then
 * ride the move with a wide trailing stop that lets real trends run and a time
 * cap only as a safety valve. This is a defensive trend strategy: it aims for a
 * similar long-term return with a clearly smaller drawdown than buying and
 * holding, not for beating holding in a strong bull.
 * Entry: last closed bar closes above the highest high of the previous 55 bars
 * AND the 50-EMA is above the 200-EMA. Exit: chandelier trailing stop 6 ATR
 * below the best close since entry, a hard stop 3 ATR below entry, or a time
 * stop after 200 bars (about 33 days) in the trade.
 * Loses in choppy sideways markets where breakouts fail and the trailing stop
 * takes small losses repeatedly; underperforms holding in strong one-way bull
 * markets because it is only in the market part of the time.
 */

function onUpdate(ctx) {
  // ---- closed-bar indicators, all guarded ----
  const emaFast = ctx.ema(50, 1);
  const emaSlow = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  // highest high of the 55 bars BEFORE the last closed bar (excludes signal bar)
  const hi55 = ctx.high(55, 2);
  if (emaFast == null || emaSlow == null || atr == null || hi55 == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;
  const inPos = pos > 0;

  // restart-surviving trade state
  const st = ctx.state || {};
  const barsIn = (typeof st.barsIn === 'number') ? st.barsIn : 0;
  const hiClose = (typeof st.hiClose === 'number') ? st.hiClose : 0;

  if (inPos) {
    const newBarsIn = barsIn + 1;
    // best CLOSED-bar close since entry (closed bars only, identical live/backtest)
    const newHi = Math.max(hiClose, ctx.closes.at(-2));
    ctx.state = { barsIn: newBarsIn, hiClose: newHi };

    // chandelier trailing stop: 6 ATR below best close since entry (wide enough for 4h noise)
    const trailStop = newHi - 6 * atr;
    // hard stop: 3 ATR below entry price (guard entryPx, may be null on first tick)
    const hardStop = (entryPx != null) ? entryPx - 3 * atr : trailStop;
    const stop = Math.max(trailStop, hardStop);

    // time exit: 200 bars = ~33 days on 4h; a pure safety valve, rarely binds
    const maxBars = 200;
    const timeUp = newBarsIn >= maxBars;

    const lastT = ctx.times.at(-1);
    const exitAt = (lastT != null) ? Math.floor(lastT / 1000) + (maxBars - newBarsIn) * 14400 : 0;

    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'chandelier stop' },
      { side: 'sell', at: exitAt, note: 'time exit after 200 bars' }
    ]);

    if (timeUp || price <= stop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // ---- flat: look for a breakout entry ----
  const prevClose = ctx.closes.at(-2);
  const breakout = prevClose > hi55;
  const trendUp = emaFast > emaSlow;

  // entry fires when price RISES above the 55-bar high, only if trend filter holds
  ctx.watch([{
    side: 'buy', price: hi55, trigger: 'above', note: 'Donchian 55 breakout',
    conds: [
      { label: 'EMA50 > EMA200', ok: trendUp },
      { label: 'close > 55-bar high', ok: breakout }
    ]
  }]);

  if (trendUp && breakout) {
    ctx.state = { barsIn: 0, hiClose: prevClose };
    const qty = (ctx.cash / price) * 0.99;
    return { side: 'buy', qty: qty };
  }
  return null;
}
