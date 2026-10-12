/*
 * @coinsori-strategy v1
 * name: SOL Macro-Gated Breakout 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the champion (SOL breakout + Fear&Greed gate) loses when
 *   the dollar strengthens and risk-off hits crypto. DXY is the macro risk
 *   switch: a falling dollar = risk-on = breakouts are genuine; a rising dollar
 *   = risk-off = breakouts fake out. This adds that macro regime filter on top
 *   of the proven breakout entry.
 * When it buys and sells: buy when DXY < 100 (risk-on), Fear&Greed < 75, price
 *   above its 100-EMA and making a fresh 20-bar high; sell on a 20-bar low
 *   close or a 2.5x ATR hard stop.
 * When it does NOT work: DXY < 100 can stay true during a local crypto crash,
 *   so it is not a complete shield; in a melt-up the EMA gate makes it enter
 *   late. It also flat-out misses any bull run that happens while DXY is above
 *   100 (2022-2024 was mostly that).
 */
function onUpdate(ctx) {
  const fg = ctx.data('fg');
  const dxy = ctx.data('dxy');
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

  if (fg != null && fg >= 75) return null;      // blow-off top blocks entry (fg null = data off, skip gate)
  if (dxy != null && dxy >= 100) return null;   // strong dollar = risk-off, no longs (100 = long-run pivot)
  if (prevClose <= ema100) return null;         // only buy in an uptrend
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;   // enter only on a FRESH breakout

  // risk 2% of cash on a 2.5x ATR stop, capped by available cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
