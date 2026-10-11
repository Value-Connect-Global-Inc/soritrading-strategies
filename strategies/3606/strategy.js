/*
 * @coinsori-strategy v1
 * name: ETH Donchian Volume-Confirmed 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated Donchian turtle breakout wins on 4H, but any
 *   range breakout can be a false move on thin volume. Adding a participation
 *   filter — the breakout bar must trade more than 1.2x its 20-bar average — keeps
 *   the entry only when real money is behind it. This is a price+volume rule, not a
 *   survey or positioning signal (those failed in every test so far).
 * When it buys and sells: buys when the last close breaks above the highest high of
 *   the prior 55 bars AND that close traded above 1.2x its 20-bar average volume AND
 *   price is above the 200 SMA. Sells on a hard 2.5x ATR stop from entry or when the
 *   close breaks below the lowest low of the prior 20 bars.
 * When it does NOT work: in long sideways ranges breakouts get bought at the top and
 *   stop out; the volume filter reduces but does not remove those. Long-only means a
 *   sustained bear market is flat-to-loss. The volume filter also skips quiet,
 *   low-volume but still valid breakouts.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const hh55 = ctx.high(55, 2);   // highest high of the 55 bars BEFORE the last close
  const ll20 = ctx.low(20, 2);    // lowest low of the 20 bars BEFORE the last close
  const sma200 = ctx.sma(200, 1);
  const vols = ctx.volumes;
  if (atr == null || hh55 == null || ll20 == null || sma200 == null || !vols || vols.length < 25) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  const prevVol = vols.at(-2);   // volume of the same closed bar we test the breakout on

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' }]);
    return null;
  }

  // entry: last close breaks the prior 55-bar high, on above-average volume, above the 200 SMA
  if (prevClose <= hh55) return null;
  if (prevClose <= sma200) return null;
  let sum = 0;
  for (let k = 2; k <= 21; k++) sum += vols.at(-k);   // 20 CLOSED bars before the breakout bar
  const avgVol = sum / 20;
  if (prevVol <= avgVol * 1.2) return null;  // 1.2x: breakout needs participation, not just a wiggle

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
