/*
 * @coinsori-strategy v1
 * name: Sentiment Trend-Follow BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index (0-100) tracks crowd sentiment.
 * Instead of fading extremes (contrarian), this follows the sentiment TREND:
 * when the index is above its own moving average, sentiment is improving and
 * buying pressure tends to persist; when it drops below, sentiment is
 * deteriorating and price tends to weaken. This bets that sentiment momentum
 * persists, which is the opposite of the failed contrarian approach.
 * When it buys and sells: stays long while the fear-greed index is above its
 * 20-day average; steps aside when it falls below.
 * When it does NOT work: sentiment is a lagging, noisy measure — in a fast
 * crash the index can drop sharply (good exit) but in a slow grind it
 * whipsaws around its average, generating many small losing trades. It also
 * misses rallies that happen while sentiment stays flat.
 * 2026-04-26 — 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  // Fear & Greed index (0-100), external dataset.
  const raw = ctx.data('fear_greed');
  const fg = Number(raw);
  if (!Number.isFinite(fg) || fg <= 0) {
    ctx.watch([]);
    return null;
  }

  // Rolling 20-bar buffer to compute the sentiment moving average.
  const hist = ctx.state.fghist || [];
  hist.push(fg);
  if (hist.length > 20) hist.shift();
  ctx.state.fghist = hist;
  if (hist.length < 20) {
    ctx.watch([]);
    return null;
  }

  let sum = 0;
  for (let i = 0; i < hist.length; i++) sum += hist[i];
  const avg = sum / hist.length;

  const sentimentUp = fg > avg * 1.01; // 1% hysteresis above its own average

  // --- Exit: sentiment deteriorated below its average ---
  if (pos > 0) {
    ctx.watch([{ side: 'sell', qty: pos, note: 'FG below 20d avg threshold', conds: [{ label: 'FG', now: fg, op: '<=', ref: avg * 1.01 }] }]);
    if (!sentimentUp) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // --- Entry: sentiment improving ---
  ctx.watch([{ side: 'buy', qty: ctx.cash / price * 0.95, note: 'FG above 20d avg threshold', conds: [{ label: 'FG', now: fg, op: '>', ref: avg * 1.01 }] }]);
  if (sentimentUp) {
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
