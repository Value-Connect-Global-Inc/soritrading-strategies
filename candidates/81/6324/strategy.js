/*
 * @coinsori-strategy v1
 * name: BTC Trend Regime Ride 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC spends most of its time in long uptrends interrupted by sharp crashes. A slow trend filter that stays fully invested while the medium trend is up and steps aside when it breaks captures most of the bull move while avoiding the worst drawdowns.
 * When it buys and sells: buys when the previous bar closes above the 20-bar high that stood BEFORE that bar — a genuine channel breakout — while price is above its 200-bar average (medium-term uptrend); sells when price closes back below a chandelier trailing stop (peak close since entry minus 4xATR), so winners are ridden but a crash never gives back more than a few ATR from the peak.
 * When it does NOT work: in a long sideways chop price repeatedly makes short-lived 20-bar highs and the strategy whipsaws, paying fees on small losses — that is the losing regime.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  // 20-bar Donchian upper channel measured BEFORE the signal bar (ago=2), so the
  // signal bar's own high is not inside the window — otherwise the close can never
  // exceed it and the breakout is always false.
  const d20High = ctx.high(20, 2);
  if (sma200 == null || atr == null || d20High == null) return null;

  const regimeUp = prevClose > sma200; // only trade inside a medium-term uptrend

  if (ctx.position <= 0) {
    const breakout = prevClose > d20High; // close above the prior 20-bar high = bull leg confirmed
    ctx.watch([{ side: 'buy', price: d20High, trigger: 'above', note: '20-bar breakout', conds: [{ label: 'regime up', ok: regimeUp }] }]);
    if (breakout && regimeUp) {
      ctx.state.peak = prevClose; // reset the trailing-stop anchor on a fresh entry
      const qty = (ctx.cash / ctx.price) * 0.98;
      return { side: 'buy', qty };
    }
    return null;
  }

  // in a position: trail a stop under the highest close since entry.
  // 4xATR gives the trade room to breathe through normal pullbacks without being
  // stopped out and re-entering (whipsaw); a tighter 3xATR caused ~95 trades/window
  // with many small losses. 4xATR still cuts a crash within a few ATR of the peak.
  const peak = Math.max(ctx.state.peak || prevClose, prevClose);
  ctx.state.peak = peak;
  const trail = peak - 4 * atr;

  ctx.watch([{ side: 'sell', price: trail, trigger: 'below', note: 'trailing stop' }]);
  if (prevClose <= trail) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
