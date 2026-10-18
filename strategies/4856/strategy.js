/*
 * @coinsori-strategy v1
 * name: BtcVixRegime1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto is a risk asset — it trends when the macro mood is calm (low VIX) and
 * crashes when fear spikes. Instead of reading crypto price momentum alone, this gates BTC exposure by
 * US stock-market volatility: buy only when VIX is low (risk-on) AND price is above its 200-day average,
 * and get out when VIX spikes (panic) or the long trend breaks. A regime filter is a different family
 * from the momentum basket — it uses macro data, not the coin's own price history.
 * When it buys and sells: buys BTC when the 200-day SMA is below price (long uptrend intact) AND VIX is
 * below 25 (calm). Sells when price falls below the 200-day SMA (trend broken) or VIX rises above 30
 * (panic regime — get out before the crash deepens).
 * When it does NOT work: in a grinding bear market price stays below the 200-day SMA so it sits in cash
 * (safe, no profit). If VIX stays low while crypto crashes for its own reasons (e.g. a crypto-specific
 * event), the VIX gate gives no protection and only the slow 200-day SMA break limits the loss. VIX data
 * is published with a lag, so live signals arrive one day late.
 */
function onUpdate(ctx) {
  const px = ctx.closes.at(-2); // last CLOSED bar so backtest, paper and live agree
  if (px == null) return null;
  const sma200 = ctx.sma(200, 1); // long-term trend on closed bars
  const vix = ctx.data('base_vix'); // US stock-market volatility — macro risk mood
  if (sma200 == null || vix == null) return null;

  const trendUp = px > sma200;
  const calm = vix < 25; // calm risk-on regime — buy only here
  const panic = vix > 30; // panic regime — get out before the crash deepens
  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: '200d SMA break' },
               { side: 'sell', price: 30, trigger: 'above', note: 'VIX panic',
                 conds: [{ label: 'VIX now', now: vix, op: '>', ref: 30, closed: true }] }]);
    if (!trendUp || panic) { // exit on trend break OR macro panic
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: '200d SMA & calm VIX',
               conds: [{ label: 'VIX < 25', now: vix, op: '<', ref: 25, closed: true }] }]);
  if (trendUp && calm) { // both the long trend and the macro mood confirm risk-on
    const qty = (ctx.cash / px) * 0.99; // single-coin: invest most of the account
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
