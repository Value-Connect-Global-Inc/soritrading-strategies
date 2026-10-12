/*
 * @coinsori-strategy v1
 * name: Onchain Hashrate Trend BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Second on-chain axis — miner hashrate (computing power).
 * Hypothesis: rising hashrate reflects growing miner commitment / network
 * security, a slow fundamental that tends to rise with a healthy market; a
 * falling hashrate can signal capitulation. Uses the same validated recipe as
 * the addr demand strategy (30-bar smoothed trend with hysteresis).
 * When it buys and sells: holds BTC while hashrate is rising vs ~30 days ago;
 * sells when it clearly turns down. Slow fundamental timing.
 * When it does NOT work: hashrate is a slow monotonic series that mostly rises,
 * so this may just hold through everything (little filtering power) — it can
 * lag sharp price moves and miss the timing that price/addr capture better.
 * On-chain data is live in the feed (verified).
 * 2025-04-11: watch declarations added — display only, trading logic unchanged.
 */
function onUpdate(ctx) {
  const pos = ctx.position;

  const raw = ctx.data('hashrate');
  const now = Number(raw);
  if (!Number.isFinite(now) || now <= 0) return null;

  const hist = ctx.state.hist || [];
  hist.push(now);
  if (hist.length > 30) hist.shift();
  ctx.state.hist = hist;
  if (hist.length < 30) return null;
  const past = hist[0];

  const rising = now > past * 1.005;
  const falling = now < past * 0.995;

  if (pos > 0) {
    if (falling) {
      ctx.watch([{ side: 'sell', price: ctx.price, trigger: 'below', note: 'hashrate falling' }]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: past * 0.995, trigger: 'below', note: 'hashrate drop exit' }]);
    return null;
  }
  if (rising) {
    ctx.watch([{ side: 'buy', price: ctx.price, trigger: 'above', note: 'hashrate rising' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  ctx.watch([{ side: 'buy', price: past * 1.005, trigger: 'above', note: 'hashrate rise entry' }]);
  return null;
}
