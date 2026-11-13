/*
 * @coinsori-strategy v1
 * name: VIX Calm-Regime BTC Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin's strongest up-trends happen when macro volatility is calm (VIX below its own 90-day average); VIX spikes mark risk-off periods when crypto tends to fall.
 * When it buys and sells: buys when VIX is calm, price is above the 4h EMA200 and that trend line is rising; sells when VIX turns clearly stressed, or price falls 3x ATR below the recent high (trailing stop), or a hard 25% stop is hit.
 * When it does NOT work: in bull years like 2024 when VIX spikes repeatedly (April, August) the gate steps aside for part of the rise; in a long quiet bear grind it stays in and takes the loss.
 */

function onUpdate(ctx) {
  const vix = ctx.data("base_vix");
  if (vix == null) return null;

  // Rolling 90-day VIX history in restart-safe state (VIX updates ~daily).
  const st = ctx.state;
  if (!st.vixHist) st.vixHist = [];
  if (st.vixHist.length === 0 || Math.abs(st.vixHist[st.vixHist.length - 1] - vix) > 1e-9) {
    st.vixHist.push(vix);
    if (st.vixHist.length > 90) st.vixHist.shift();
  }
  if (st.vixHist.length < 30) return null; // need ~30 days of VIX history before the mean is trustworthy

  let sum = 0;
  for (let i = 0; i < st.vixHist.length; i++) sum += st.vixHist[i];
  const vixMean = sum / st.vixHist.length;

  // Closed-bar values so backtest/live/paper agree.
  const ema200 = ctx.ema(200, 1);
  const ema200prev = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  const hi100 = ctx.high(100, 1);
  const close1 = ctx.closes.at(-2);
  if (ema200 == null || ema200prev == null || atr == null || hi100 == null || close1 == null) return null;
  const price = ctx.price;

  // Wide hysteresis: enter only clearly calm, exit only clearly stressed.
  const calm = vix < vixMean - 0.5;
  const stressed = vix > vixMean + 2.0;

  const inPos = ctx.position > 0;

  if (!inPos) {
    ctx.watch([{
      side: 'buy', price: ema200, trigger: 'above', note: 'EMA200 reclaim',
      conds: [{ label: 'VIX calm', ok: calm }, { label: 'EMA200 rising', ok: ema200 > ema200prev }]
    }]);
    if (calm && close1 > ema200 && ema200 > ema200prev) {
      return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
    }
    return null;
  }

  // Trailing stop: 3x ATR below the highest high of the last 100 bars (restart-safe).
  const trail = hi100 - 3 * atr;
  const stopPx = ctx.entryPx != null ? ctx.entryPx * 0.75 : null;
  ctx.watch([
    { side: 'sell', price: trail, trigger: 'below', note: 'chandelier stop', conds: [{ label: 'VIX stressed', ok: stressed }] },
    { side: 'sell', price: stopPx, trigger: 'below', note: '25% hard stop' }
  ]);

  if (stressed) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  if (close1 < trail) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  if (stopPx != null && price <= stopPx) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
