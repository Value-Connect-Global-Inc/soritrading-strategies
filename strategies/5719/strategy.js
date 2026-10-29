/*
 * @coinsori-strategy v1
 * name: BTC Dollar-Regime Filter 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Most crypto assets are priced in dollars, so a strengthening US dollar (tight global liquidity) historically pressures BTC. The dollar index is information BTC price alone cannot see.
 * When it buys and sells: Buys and holds BTC while the US dollar index is below its own 200-day average (weak/neutral dollar). Sells to cash when the dollar climbs above its 200-day average (strong dollar = headwind).
 * When it does NOT work: In periods where crypto is driven by crypto-specific news (halvings, ETF flows) regardless of the dollar, the filter can be on the wrong side or flip too often. The dollar index is also published with a lag and only on business days.
 */
function onUpdate(ctx) {
  const dxy = ctx.data("dxy");
  if (dxy == null) return null; // dollar data not available (weekend/holiday) — just hold

  // keep a ring buffer of the last 200 dollar readings (business days only)
  const hist = ctx.state.dxyHist || [];
  hist.push(dxy);
  if (hist.length > 200) hist.shift();
  ctx.state.dxyHist = hist;

  if (hist.length < 200) return null; // not enough history yet — no trades

  const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
  // dollar above its own 200-day trend = liquidity tightening = headwind for BTC
  const riskOff = dxy > avg;

  const price = ctx.price;
  if (ctx.position > 0) {
    if (riskOff) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null; // dollar neutral/weak — keep holding
  }

  if (!riskOff && ctx.cash > 0) {
    return { side: 'buy', qty: ctx.cash / price * 0.99 };
  }
  return null;
}
