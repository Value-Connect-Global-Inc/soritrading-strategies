/*
 * @coinsori-strategy v1
 * name: VolumeSpikeMomentumStrategy
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Sudden volume expansion combined with positive momentum signals institutional accumulation and a continuation of trend.
 * When it buys and sells: Buys when volume is significantly higher than average and short-term RSI/price is rising; sells on take profit or stop-loss.
 * When it does NOT work: Fails during false volume spikes or choppy range-bound markets with high friction.
 */

function onUpdate(ctx) {
  const i = ctx.i;
  if (i < 30) return null;

  const closes = ctx.closes;
  const price = ctx.price;
  const pos = ctx.position;

  const p1 = closes.at(-2);
  const p2 = closes.at(-3);
  const rsi = ctx.rsi(14, 1);
  const sma20 = ctx.sma(20, 1);
  const avgVol = ctx.avgVol(20);
  const currentVol = ctx.volPrev;

  if (rsi == null || sma20 == null || avgVol == null || currentVol == null) return null;

  // Manage existing position
  if (pos > 0) {
    const entryPx = ctx.entryPx || price;
    const pnlPct = (price - entryPx) / entryPx;
    
    ctx.watch([
      { side: 'sell', price: entryPx * 1.05, trigger: 'above', note: 'Take Profit 5%' },
      { side: 'sell', price: entryPx * 0.97, trigger: 'below', note: 'Stop Loss -3%' }
    ]);

    if (pnlPct >= 0.05 || pnlPct <= -0.03 || price < sma20) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Entry condition: Volume > 2x average, RSI > 50, Price > SMA20
  const isVolSpike = currentVol > avgVol * 2.0;
  const isBullish = p1 > p2 && p1 > sma20 && rsi > 50 && rsi < 75;

  ctx.watch([
    {
      side: 'buy',
      price: price,
      trigger: 'above',
      note: 'Volume spike breakout',
      conds: [
        { label: 'Vol > 2x Avg', ok: isVolSpike },
        { label: 'RSI > 50', now: rsi, op: '>', ref: 50, closed: true },
        { label: 'Price > SMA20', ok: p1 > sma20 }
      ]
    }
  ]);

  if (isVolSpike && isBullish) {
    const qty = (ctx.cash / price) * 0.95;
    if (qty > 0) {
      return { side: 'buy', qty: qty };
    }
  }

  return null;
}
