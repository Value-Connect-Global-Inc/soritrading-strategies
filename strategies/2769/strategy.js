/*
 * @coinsori-strategy v1
 * name: Onchain Addr Probe
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic probe. Determines whether ctx.data('addr')
 * (the user's on-chain active-address dataset) is present and coercible to a
 * number per-bar in the backtest engine. It buys whenever the value is a finite
 * number, so the trade count tells us if the data feed is live.
 * When it buys and sells: buys when the on-chain value is a usable number;
 * sells when it is not. Pure data-availability probe, not a real strategy.
 * When it does NOT work: if the feed is null/static, the probe stays flat and
 * tells us this axis cannot be validated here.
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const raw = ctx.data('addr');
  const n = Number(raw);
  const usable = Number.isFinite(n) && n > 0;

  // 가격/시간 대기 조건이 없는 순수 데이터 가용성 프로브이므로 watch는 빈 배열로 선언
  ctx.watch([]);

  if (pos > 0) {
    if (!usable) return { side: 'sell', qty: pos };
    return null;
  }
  if (usable) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
