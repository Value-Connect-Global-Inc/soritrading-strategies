/*
 * @coinsori-strategy v1
 * name: SOL Volume-Confirmed Trend 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the proven champion (SOL sentiment-gated trend 4h) enters
 *   on a 20-bar high breakout. This variant adds a volume-confirmation axis: a
 *   breakout on above-average volume is more likely to be a real move, not a
 *   low-volume fakeout. Everything else stays identical to the champion.
 * When it buys and sells: buy when Fear&Greed < 75, price is above its 100-EMA,
 *   makes a fresh 20-bar high, AND volume is above its 20-bar average; sell when
 *   price closes below the 20-bar low or hits a 2.5x ATR hard stop.
 * When it does NOT work: same as the champion — in a melt-up it enters late and
 *   misses part of the move; in a slow grind down with mild fear the EMA gate
 *   keeps it out. The volume filter can also reject some valid quiet breakouts.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fg');
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' }]);
    return null;
  }

  if (fg != null && fg >= 75) return null;   // only a blow-off top blocks entry (fg null = data off, skip gate)
  if (prevClose <= ema100) return null;      // only buy in an uptrend
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;   // enter only on a FRESH breakout

  // NEW AXIS: volume confirmation — breakout must come on above-average volume.
  // Reason: low-volume breakouts are often fakeouts; this filters them out.
  const avgVol = ctx.avgVol(20);
  const vol = ctx.vol;
  if (avgVol == null || vol == null || vol <= avgVol) return null;

  // risk 2% of cash on a 2.5x ATR stop, capped by available cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
