/*
 * @coinsori-strategy v1
 * name: BTC Funding Contrarian 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Uses the perpetual funding rate as a crowd-positioning gauge. When funding is far
 * below its recent average (shorts pay longs heavily = crowded shorts) while the
 * trend is up, it buys the squeeze; it exits when funding normalizes or the trend breaks.
 * Does not work in a long grinding downtrend where negative funding persists while
 * price keeps falling — the SMA200 regime filter keeps it out of bear markets but
 * cannot remove all whipsaw risk in choppy ranges.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  const cash = ctx.cash;

  const sma = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const funding = ctx.funding;
  if (sma == null || sma200 == null || funding == null) return null;

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // rolling funding z-score: how unusual today's funding is vs the last ~10 weeks
  const hist = ctx.state.fundHist || [];
  hist.push(funding);
  if (hist.length > 400) hist.shift();
  ctx.state.fundHist = hist;

  let fundZ = 0;
  if (hist.length >= 60) {
    const n = hist.length;
    const mean = hist.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);
    if (sd > 1e-9) fundZ = (funding - mean) / sd;
  }

  // only act in an established uptrend (price above the 200-bar average)
  const inUptrend = prevClose > sma200;

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    // hard stop at 3x ATR below entry so a bad squeeze can't run the account down
    const stop = (ctx.entryPx != null && atr != null) ? ctx.entryPx - 3 * atr : null;
    const exits = [
      { side: 'sell', price: sma, trigger: 'below', note: 'trend break', conds: [{ label: 'fund z>0', ok: fundZ > 0 }] }
    ];
    if (stop != null) exits.push({ side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' });
    ctx.watch(exits);

    if (stop != null && price < stop) return { side: 'sell', qty: pos, reduceOnly: true };
    if (fundZ > 0 || !inUptrend) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 uptrend', conds: [{ label: 'fund z', now: Math.round(fundZ * 10) / 10, op: '<', ref: -1 }] }
  ]);

  // buy the squeeze: established uptrend + funding unusually negative (crowded shorts)
  if (inUptrend && fundZ < -1) {
    return { side: 'buy', qty: cash / price * 0.5 };
  }
  return null;
}
