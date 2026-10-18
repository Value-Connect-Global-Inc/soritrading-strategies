/*
 * @coinsori-strategy v1
 * name: BtcVixRegimeTrend1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's worst drawdowns cluster in risk-off episodes when
 *   equity volatility (VIX) spikes. Instead of timing price breakouts (which
 *   whipsawed in prior tests), this strategy only rides BTC's uptrend while the
 *   macro regime is calm (VIX below 20) and steps aside when volatility explodes.
 *   This is a different axis — macro regime, not price level.
 * When it buys and sells: buys when VIX is calm (below 20) AND price is above its
 *   200-day average (confirmed uptrend). Sells when VIX rises above 25 (risk-off),
 *   price closes below the 200-day average, or price drops 2x ATR below entry.
 *   Position size risks only 2% of the account on that stop.
 * When it does NOT work: in a calm but steadily falling market (VIX low while BTC
 *   also falls) it stays in cash and gains nothing; in a violent V-shaped recovery
 *   it re-enters only after VIX falls back below 20, so it misses the first leg.
 *   VIX is observed with a 2-day lag, so a sudden crash can hit before the exit.
 */

function onUpdate(ctx) {
  // Macro regime gauge: CBOE VIX (lagged ~2 days by design of the dataset).
  const vix = ctx.data("base_vix");
  const sma200 = ctx.sma(200, 1);   // closed-bar 200-day trend
  const atr = ctx.atr(14, 1);
  if (vix == null || sma200 == null || atr == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    // Exit: risk-off (VIX>25), trend broken, or hard 2x ATR stop.
    const stopPx = ctx.entryPx != null ? ctx.entryPx - 2 * atr : -Infinity;
    if (vix > 25 || prevClose < sma200 || price <= stopPx) {
      return { side: 'sell', qty: ctx.position };
    }
    ctx.watch([
      { side: 'sell', price: stopPx, trigger: 'below', note: '2x ATR stop',
        conds: [{ label: 'VIX', now: vix, op: '>', ref: 25 }] },
      { side: 'sell', price: sma200, trigger: 'below', note: '200d MA break' }
    ]);
    return null;
  }

  // Entry: calm volatility AND confirmed uptrend.
  if (vix >= 20 || prevClose <= sma200) return null;

  // Risk 2% on a 2x ATR adverse move; cap at ~99% of cash.
  const stopDist = 2 * atr;
  let qty = (ctx.cash * 0.02) / stopDist;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'above 200d MA',
      conds: [{ label: 'VIX', now: vix, op: '<', ref: 20 }] }
  ]);
  return { side: 'buy', qty };
}
