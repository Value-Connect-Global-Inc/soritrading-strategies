/*
 * @coinsori-strategy v1
 * name: Yield-Curve Regime Gate BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the 10y-2y US Treasury yield curve inverts before risk-off periods and stays positive through bull years. It was positive 100% of 2020/2021/2025 (BTC bull years) and inverted most of 2022/2023 (BTC drawdown years) — a slow macro risk-on/off switch.
 * When it buys and sells: buys when the curve is not deeply inverted (spread > -0.2), price is above its 1y SMA200 and RSI(14) is below 70; sells when the curve inverts (spread < -0.2), price breaks below SMA200, or a 20% hard stop is hit.
 * When it does NOT work: in a bull year that starts while the curve is still inverted (2023) the gate waits too long and misses the early recovery; the RSI<70 filter can also skip the strongest part of a breakout.
 */

function onUpdate(ctx) {
  const spread = ctx.data("base_t10y2y");
  if (spread == null) return null;

  // Closed-bar values so backtest/live/paper agree.
  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  const close1 = ctx.closes.at(-2);
  if (sma200 == null || rsi == null || close1 == null) return null;
  const price = ctx.price;

  // -0.2: allow longs unless the curve is clearly inverted (not just barely negative).
  const riskOn = spread > -0.2;

  if (ctx.position <= 0) {
    ctx.watch([{
      side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 reclaim',
      conds: [{ label: 'curve not inverted', ok: riskOn }, { label: 'RSI(14)', now: rsi, op: '<', ref: 70, closed: true }]
    }]);
    if (riskOn && close1 > sma200 && rsi < 70) {
      return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
    }
    return null;
  }

  const stopPx = ctx.entryPx != null ? ctx.entryPx * 0.8 : null;
  ctx.watch([
    { side: 'sell', price: sma200, trigger: 'below', note: 'trend break', conds: [{ label: 'curve inverted', ok: !riskOn }] },
    { side: 'sell', price: stopPx, trigger: 'below', note: '20% hard stop' }
  ]);
  if (!riskOn) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  if (close1 < sma200) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  if (stopPx != null && price <= stopPx) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
