/*
 * @coinsori-strategy v1
 * name: BTC Fear&Greed Dip-Buy 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The crypto Fear & Greed index (0-100, daily) measures crowd mood. Within a
 * healthy uptrend, panic dips (extreme fear) are buying opportunities, and greed marks exits.
 * This is a different entry mechanism than breakout trend-following: we buy the dip, not the breakout.
 * When it buys and sells: buys when the index is in extreme fear (<25) while price holds above its
 * 200-day trend; sells when the index reaches greed (>70) or price closes below the 200-day trend.
 * When it does NOT work: a true bear market — extreme fear repeats and the 200-day gate may not
 * exit fast enough, and in a strong straight-line bull we are out too early and miss part of the rise.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const cash = ctx.cash;

  // ---- sentiment data (daily) ----
  const fg = ctx.data("fear_greed"); // 0 (extreme fear) to 100 (extreme greed)
  if (fg == null) return null;

  // ---- trend gate on CLOSED bars ----
  const prevClose = ctx.closes.at(-2);
  const sma200 = ctx.sma(200, 1);
  if (prevClose == null || sma200 == null) return null;
  const uptrend = prevClose > sma200;

  // ---- volatility for sizing (closed bar) ----
  const atr = ctx.atr(14, 1);
  const atrPct = atr != null && atr > 0 ? atr / price : null;

  const inPos = ctx.position > 0;

  // Entry: extreme fear (25 = published 'extreme fear' zone boundary) inside an uptrend.
  const wantBuy = !inPos && fg < 25 && uptrend;
  // Exit: greed (70 = published 'greed' zone boundary) or trend broken.
  const wantSell = inPos && (fg > 70 || prevClose < sma200);

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'uptrend + panic dip',
      conds: [ { label: 'Fear&Greed index', now: fg, op: '<', ref: 25, closed: true } ] },
    { side: 'sell', price: sma200, trigger: 'below', note: 'trend break',
      conds: [ { label: 'Fear&Greed index', now: fg, op: '>', ref: 70, closed: true } ] }
  ]);

  if (wantSell) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  if (wantBuy) {
    // Vol-target sizing: aim ~3% daily vol, cap at 80% of cash.
    let pct = 0.8;
    if (atrPct != null && atrPct > 0) pct = Math.min(0.8, 0.03 / atrPct);
    const qty = (cash * pct) / price;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
