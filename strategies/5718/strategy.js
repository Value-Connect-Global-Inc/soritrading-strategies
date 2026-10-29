/*
 * @coinsori-strategy v1
 * name: BTC Macro Risk-Off VIX Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin trades like a high-beta risk asset, so the stock market's fear gauge (VIX) should tell us when the whole risk complex is under stress — information that BTC price alone cannot see.
 * When it buys and sells: Buys and holds BTC while the VIX is calm (below 25). Sells everything to cash the moment the VIX rises above 25, and stays out until fear cools back below it.
 * When it does NOT work: In a slow-burn crypto bear like 2018, stock-market fear stayed low while BTC fell for a year — this filter would stay "risk-on" and give back gains. It also exits a few days late because the VIX is published with a 2-day lag.
 */
function onUpdate(ctx) {
  const vix = ctx.data("base_vix");
  if (vix == null) return null; // macro data not available yet

  const price = ctx.price;
  // 25 = classic elevated-fear line; VIX long-run average is ~19-20, spiking above 25 marks stress
  const riskOff = vix > 25;

  if (ctx.position > 0) {
    if (riskOff) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null; // fear calm — keep holding
  }

  if (!riskOff && ctx.cash > 0) {
    return { side: 'buy', qty: ctx.cash / price * 0.99 };
  }
  return null;
}
