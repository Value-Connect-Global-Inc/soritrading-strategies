/*
 * @coinsori-strategy v1
 * name: BTC-ETH-SOL Dip-Buy Mean Reversion 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The champion (5560) is an always-invested inverse-vol basket that bleeds
 * in broad bears. This is a different family — tactical dip-buying. It buys a coin only after
 * a deep oversold dip while that coin is still above its 200-bar average (uptrend only), then
 * sells back to the mean. It never chases tops and never catches falling knives in a bear.
 * When it buys and sells: Each coin independently buys when the previous closed bar is below
 * the lower Bollinger band (20,2) AND RSI(14) is below 30 AND the close is still above the
 * 200-bar EMA. It sells when the close climbs back above the 20-bar EMA, or if the price
 * falls 15% below entry (hard stop). Each coin gets one third of the account.
 * When it does NOT work: In a straight-line bull with no pullbacks it sits in cash and lags
 * buy-and-hold badly. A dip that keeps falling still hits the 15% stop. Its job is small
 * steady gains and small drawdowns, not beating a raging bull.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  // Portfolio equity = cash + all open positions, so buying one coin does not shrink
  // the sizing base of the others (same pattern as champion 5560).
  let equity = ctx.cash;
  const positions = ctx.positions;
  if (positions != null) {
    const list = Array.isArray(positions) ? positions : Object.values(positions);
    for (const p of list) {
      if (p != null && p.qty > 0 && p.price > 0) equity += p.qty * p.price;
    }
  }
  if (equity <= 0) return null;

  const pos = ctx.pos(sym);
  const held = pos != null && pos > 0;

  // Closed-bar indicators only (identical in backtest, paper and live).
  const ema200 = ctx.ema(200, 1);
  const ema20 = ctx.ema(20, 1);
  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema200 == null || ema20 == null || rsi == null || bb == null || prevClose == null) return null;

  const SLICE = 1 / 3; // 3 coins, each gets one third of the account

  if (held) {
    const entry = ctx.entryPx;
    // Exit: reverted to the mean (close back above EMA20), or the trade is clearly
    // wrong (15% hard stop). 15% = the validated SOL 4h dip-buy stop, wide enough
    // to survive a normal pullback but tight enough to cap a trend break.
    if (prevClose > ema20 || (entry != null && price < entry * 0.85)) {
      ctx.watch([{ side: 'sell', note: 'MR exit (mean or stop)' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    const w = [{ side: 'sell', price: ema20, trigger: 'above', note: 'mean exit' }];
    if (entry != null) w.push({ side: 'sell', price: entry * 0.85, trigger: 'below', note: 'hard stop' });
    ctx.watch(w);
    return null;
  }

  // Entry: deep oversold dip inside an uptrend. RSI<30 + below lower BB = genuine
  // panic; close>EMA200 = never buy a falling knife in a bear market.
  const dip = prevClose < bb.lower && rsi < 30;
  if (!dip || prevClose <= ema200) {
    ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB-lower dip', conds: [
      { label: 'RSI14', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'close>EMA200', ok: prevClose > ema200, closed: true }
    ]}]);
    return null;
  }

  const qty = SLICE * equity / price;
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', note: 'oversold dip buy' }]);
  return { side: 'buy', qty: qty };
}
