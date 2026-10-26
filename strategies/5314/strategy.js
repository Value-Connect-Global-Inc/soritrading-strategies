/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is driven more by crowd emotion than by
 * fundamentals. When the Fear & Greed index hits extreme fear, sellers are
 * exhausted and prices are usually near a local bottom; when it hits extreme
 * greed, buyers are exhausted and prices are usually near a local top. We buy
 * the fear and sell the greed.
 * When it buys and sells: buys when yesterday's Fear & Greed is 20 or below
 * (extreme fear) AND the daily close is above the 200-day average (long-term
 * uptrend intact, so we do not catch bear-market knives). Sells when the index
 * reaches 75 (extreme greed) or price falls 2.5x ATR below entry as a safety
 * stop. After any exit it waits 14 days before buying again.
 * When it does NOT work: in a long bear market it stays out (trend filter) and
 * never catches the final bottom; if extreme-fear bounces keep failing it
 * stops out repeatedly; it is long or flat only, so it cannot profit from
 * falling prices.
 */
function onUpdate(ctx) {
  const FEAR = 20;      // buy when index is at or below this (extreme fear)
  const GREED = 75;     // sell when index is at or above this (extreme greed)
  const ATR_STOP = 2.5; // hard stop: 2.5x daily ATR below entry
  const RISK = 0.02;    // fraction of equity risked per trade
  const COOLDOWN = 14;  // days to wait after an exit before buying again

  const fg = ctx.data('fear_greed');
  if (fg == null) return null;
  // trade on YESTERDAY's published sentiment, never today's (avoids lookahead)
  const prevFg = ctx.state.prevFg;
  ctx.state.prevFg = fg;
  if (prevFg == null) return null;

  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (atr == null || sma200 == null || prevClose == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;

  // ---- EXIT ----
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry == null) return null;
    const stopPx = entry - ATR_STOP * atr;
    ctx.watch([
      { side: 'sell', price: GREED, trigger: 'above', note: 'extreme greed' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '2.5x ATR stop' }
    ]);
    if (prevFg >= GREED || price <= stopPx) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // ---- ENTRY: extreme fear + uptrend intact + cooldown ----
  const lastExit = ctx.state.lastExit;
  const cooled = lastExit == null || ctx.i - lastExit >= COOLDOWN;
  const uptrend = prevClose > sma200;
  ctx.watch([{
    side: 'buy', price: FEAR, trigger: 'below', note: 'extreme fear + uptrend',
    conds: [
      { label: 'close>SMA200', ok: uptrend, closed: true },
      { label: 'cooldown', ok: cooled, closed: true }
    ]
  }]);
  if (prevFg <= FEAR && uptrend && cooled) {
    const riskAmt = ctx.cash * RISK;
    const stopDist = ATR_STOP * atr;
    if (stopDist <= 0) return null;
    const qty = Math.min(riskAmt / stopDist, (ctx.cash / price) * 0.98);
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
