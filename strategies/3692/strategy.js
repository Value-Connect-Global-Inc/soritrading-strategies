/*
 * @coinsori-strategy v1
 * name: DollarRegimeTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin trades as a risk asset, so a strong/rising US
 * dollar usually pressures it while a weak/falling dollar lets it run. Using
 * the dollar index trend as a regime filter on top of BTC's own 200-day
 * trend keeps the strategy on the right side of the macro wind.
 * When it buys and sells: buy when BTC is above its 200-day average AND the
 * dollar index is below its own 50-day average (weak-dollar regime); sell
 * when BTC falls below its 200-day average, the dollar turns strong (above
 * its 50-day average), or a 2x ATR stop is hit.
 * When it does NOT work: when BTC trends up strongly while the dollar is also
 * strong (rare but real), the filter keeps it out of the move; in a long bear
 * with a strong dollar it never trades (safe but flat). If the dollar feed is
 * missing it cannot trade.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const rawDxy = ctx.data('dxy');
  // The dataset delivers the value as a string; coerce before using it.
  const dxy = (rawDxy == null || rawDxy === '') ? null : Number(rawDxy);
  if (sma200 == null || atr == null || atr <= 0 || !Number.isFinite(dxy)) return null;

  // Rolling 50-day average of the dollar index, maintained in state (the
  // dataset gives the current value; we build the window ourselves).
  const st = ctx.state;
  const hist = st.dxyHist || (st.dxyHist = []);
  hist.push(dxy);
  if (hist.length > 50) hist.shift();
  let dxySma = null;
  if (hist.length >= 50) {
    let s = 0; for (let k = 0; k < 50; k++) s += hist[k];
    dxySma = s / 50;
  }
  if (dxySma == null) return null;

  const pos = ctx.pos(ctx.sym);
  const qty = (ctx.cash / price) * 0.7;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    // Exit on the protective stop, a broken uptrend, or a strong-dollar turn.
    if (price <= hardStop || price < sma200 || dxy > dxySma) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'uptrend broke',
                 conds: [{ label: 'DXY>SMA50', ok: dxy > dxySma }] }]);
    return null;
  }

  // Long only when both trends agree: BTC above 200d and dollar below 50d.
  if (price > sma200 && dxy < dxySma) {
    ctx.watch([]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend + weak dollar',
               conds: [{ label: 'DXY<SMA50', ok: dxy < dxySma }, { label: 'DXY', now: dxy, op: '<', ref: dxySma, closed: true }] }]);
  return null;
}
