/*
 * @coinsori-strategy v1
 * name: Fed-Easing Regime BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a liquidity asset — when the US central bank cuts
 * interest rates, cheap money tends to flow into risk assets including crypto.
 * By only being long while the Fed is in an easing cycle (rate falling) AND price
 * is above its 200-day trend, the strategy rides bull markets that are backed by
 * looser monetary policy and sits in cash when the Fed is tightening or neutral.
 * When it buys and sells: buys when the Fed funds rate is below its level 30 days
 * ago (easing) and the previous close is above the 200-day EMA; sells when the
 * close drops below the 200-day EMA, the Fed starts hiking again, or a 15% hard
 * stop is hit.
 * When it does NOT work: if the market rallies while the Fed is NOT cutting
 * (e.g. a liquidity-driven bull run with rates on hold), this strategy stays in
 * cash and misses the move. It also whipsaws if the Fed pauses rates right at the
 * 30-day comparison boundary. It is a regime filter, not a timing signal.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fed = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  const ema200 = ctx.ema(200, 1);
  const c = ctx.closes;
  // guard every data source: any null = unknown, treat as "no trade"
  if (fed == null || fedLag == null || ema200 == null || c.length < 2) return null;

  const prevClose = c.at(-2);
  const easing = fed < fedLag;   // rate now below rate 30d ago = cutting cycle

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;   // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (fed > fedLag) return { side: 'sell', qty: pos };         // Fed hiking again
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: 'Fed easing', ok: easing, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: 'Fed easing', ok: easing, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !easing) return null;

  const qty = (ctx.cash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
