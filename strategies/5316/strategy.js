/*
 * @coinsori-strategy v1
 * name: BTC RSI Uptrend-Dip Reversion 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: inside a long-term uptrend, short-term oversold readings
 * (RSI <= 30) mark dip-buying opportunities because the trend tends to resume.
 * We only buy dips when the market is still above its 200-day average, so we
 * never catch the falling knife of a real downtrend.
 * When it buys and sells: buys when RSI(14) is 30 or below AND the daily close
 * is above the 200-day average (dips in an uptrend). Sells when RSI reaches 70
 * (overbought) or price falls 2.5x ATR below entry as a safety stop. After any
 * exit it waits 10 days before buying again.
 * When it does NOT work: in a strong downtrend it stays out (good); if the
 * 200-day average itself breaks down it can still stop out; in a fast bull it
 * rarely gets an oversold RSI so it sits in cash and misses the rally. It is
 * long or flat only.
 */
function onUpdate(ctx) {
  const RSI_LO = 30;    // buy when RSI is at or below this (oversold)
  const RSI_HI = 70;    // sell when RSI is at or above this (overbought)
  const ATR_STOP = 2.5; // hard stop: 2.5x daily ATR below entry
  const RISK = 0.02;    // fraction of equity risked per trade
  const COOLDOWN = 10;  // days to wait after an exit before buying again

  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (rsi == null || atr == null || sma200 == null || prevClose == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;

  // ---- EXIT ----
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry == null) return null;
    const stopPx = entry - ATR_STOP * atr;
    ctx.watch([
      { side: 'sell', price: RSI_HI, trigger: 'above', note: 'RSI overbought' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '2.5x ATR stop' }
    ]);
    if (rsi >= RSI_HI || price <= stopPx) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // ---- ENTRY: oversold + uptrend intact + cooldown ----
  const lastExit = ctx.state.lastExit;
  const cooled = lastExit == null || ctx.i - lastExit >= COOLDOWN;
  const uptrend = prevClose > sma200;
  ctx.watch([{
    side: 'buy', price: RSI_LO, trigger: 'below', note: 'RSI oversold + uptrend',
    conds: [
      { label: 'close>SMA200', ok: uptrend, closed: true },
      { label: 'cooldown', ok: cooled, closed: true }
    ]
  }]);
  if (rsi <= RSI_LO && uptrend && cooled) {
    const riskAmt = ctx.cash * RISK;
    const stopDist = ATR_STOP * atr;
    if (stopDist <= 0) return null;
    const qty = Math.min(riskAmt / stopDist, (ctx.cash / price) * 0.98);
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
