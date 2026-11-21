/*
 * @coinsori-strategy v1
 * name: BTC Vol-Confirmed Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In strong uptrends, a pullback that closes back above the 50-bar average
 * on unusually high volume and expanding volatility tends to continue higher.
 * When it buys and sells: Buys when price closes above the 50-bar SMA while the 200-bar SMA
 * trend is up, confirmed by volume > 1.3x its 50-bar average and ATR expansion. Sells at a
 * 3xATR stop-loss, a 4xATR take-profit, or when price closes back below the 50-bar SMA.
 * When it does NOT work: In ranging, choppy markets with no sustained trend, false crossovers
 * and volume spikes whipsaw it into many small stop-outs.
 */
function onUpdate(ctx) {
  const close1 = ctx.closes.at(-2);
  const close2 = ctx.closes.at(-3);
  const sma200 = ctx.sma(200, 1);
  const sma50_1 = ctx.sma(50, 1);
  const sma50_2 = ctx.sma(50, 2);
  const atr14 = ctx.atr(14, 1);
  const atr50 = ctx.atr(50, 1);
  const avgVol = ctx.avgVol(50);
  if (close1 == null || close2 == null || sma200 == null || sma50_1 == null ||
      sma50_2 == null || atr14 == null || atr50 == null || avgVol == null) return null;

  const volClosed = ctx.volumes.at(-2);
  if (volClosed == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;

  // ---- exits: check every tick while holding ----
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry == null) return null;
    const stop = ctx.state.stop != null ? ctx.state.stop : entry - 3 * atr14;
    const target = ctx.state.target != null ? ctx.state.target : entry + 4 * atr14;
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' },
      { side: 'sell', price: target, trigger: 'above', note: 'ATR target' },
      { side: 'sell', price: sma50_1, trigger: 'below', note: 'Trend break' }
    ]);
    if (price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price >= target) return { side: 'sell', qty: pos, reduceOnly: true };
    if (close1 < sma50_1) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // ---- entries: only while flat ----
  const crossUp = close2 <= sma50_2 && close1 > sma50_1; // momentum turn up on a closed bar
  const uptrend = close1 > sma200;                       // regime: only long in an uptrend
  const volSurge = volClosed > 1.3 * avgVol;             // volume confirms participation
  const volExp = atr14 > atr50;                          // short-term vol above longer = expansion

  if (crossUp && uptrend && volSurge && volExp) {
    const stopDist = 3 * atr14;
    if (stopDist <= 0) return null;
    const risk = ctx.cash * 0.01;                        // risk only 1% of cash per trade
    const qty = Math.min(ctx.cash / price * 0.99, risk / stopDist);
    if (qty <= 0) return null;
    const stop = price - stopDist;
    const target = price + 4 * atr14;
    ctx.state.stop = stop;
    ctx.state.target = target;
    ctx.watch([
      { side: 'buy', price: sma50_1, trigger: 'above', note: 'SMA50 cross + vol', conds: [
        { label: 'Close>SMA200', ok: uptrend },
        { label: 'Vol>1.3xAvg', now: volClosed / avgVol, op: '>', ref: 1.3, closed: true },
        { label: 'ATR14>ATR50', ok: volExp }
      ]},
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' },
      { side: 'sell', price: target, trigger: 'above', note: 'ATR target' }
    ]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([
    { side: 'buy', price: sma50_1, trigger: 'above', note: 'SMA50 cross' },
    { side: 'buy', price: sma200, trigger: 'above', note: 'Uptrend' }
  ]);
  return null;
}
