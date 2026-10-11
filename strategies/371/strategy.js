function onUpdate(ctx) {
  const s = ctx.state;
  const pos = ctx.position ?? 0;
  const isHolding = pos >= 0.0001;

  // 1. 봉 롤링 메모리 관리
  if (s.lastBarI !== ctx.i) {
    s.prevHi = s.snapHi ?? null;
    s.prevLo = s.snapLo ?? null;
    s.lastBarI = ctx.i;
  }
  s.snapHi = ctx.high(40); // 40봉 고점
  s.snapLo = ctx.low(20);  // 20봉 저점

  if (s.prevHi == null || s.prevLo == null) return null;
  const ema200 = ctx.ema(200);
  const atr = ctx.atr(14);
  if (ema200 == null || atr == null) return null;

  // 2. 포지션 상태 전이 감지
  if (isHolding && !s.wasHolding) {
    s.entryBar = ctx.i;
    s.entryPx = ctx.price;
    s.highestPx = ctx.price;
    s.stopPx = null;
    s.wasHolding = true;
  } else if (!isHolding && s.wasHolding) {
    s.lastExitBar = ctx.i;
    s.entryBar = null;
    s.entryPx = null;
    s.highestPx = null;
    s.stopPx = null;
    s.wasHolding = false;
  }

  // 3. 보유 상태: 20봉 저점 & 최고가 - 3.0*ATR 래칫 스탑
  if (isHolding) {
    s.highestPx = Math.max(s.highestPx ?? ctx.price, ctx.price);
    const channelStop = s.prevLo;
    const atrStop = s.highestPx - 3.0 * atr;
    const targetStop = Math.max(channelStop, atrStop);

    if (s.stopPx == null || targetStop > s.stopPx) {
      s.stopPx = targetStop;
    }

    // 표시만 바뀜, 매매 판단은 그대로
    ctx.watch([{
      side: 'sell',
      price: s.stopPx,
      trigger: 'below',
      qty: pos,
      note: '래칫 스탑',
      conds: [
        { label: '20봉 저점', now: channelStop, op: '<=', ref: s.stopPx, closed: true },
        { label: '최고가-3ATR', now: atrStop, op: '<=', ref: s.stopPx, closed: true }
      ]
    }]);

    if (ctx.price <= s.stopPx) {
      return [{ cancel: 'all' }, { side: 'sell', qty: pos }];
    }

    return [
      { cancel: 'all' },
      { side: 'sell', qty: pos, type: 'smart', trigger: { type: 'stop', px: s.stopPx } }
    ];
  }

  // 4. 무포지션 상태
  if (s.lastExitBar != null && (ctx.i - s.lastExitBar) < 2) {
    return { cancel: 'all' };
  }

  // 대추세 EMA200 위에서만 돌파 허용
  if (ctx.price <= ema200) {
    return { cancel: 'all' };
  }

  const breakoutPx = s.prevHi;
  if (ctx.price >= breakoutPx) {
    return { cancel: 'all' };
  }

  const cash = ctx.cash ?? 0;
  if (cash < 50000) return { cancel: 'all' }; // KRW 기준 5만원

  const qty = Math.floor((cash * 0.98 / breakoutPx) * 10000) / 10000;
  if (qty <= 0) return { cancel: 'all' };

  // 표시만 바뀜, 매매 판단은 그대로
  ctx.watch([{
    side: 'buy',
    price: breakoutPx,
    trigger: 'above',
    qty,
    note: '40봉 돌파',
    conds: [
      { label: 'EMA200', ok: ctx.price > ema200, closed: true },
      { label: '현금', now: cash, op: '>=', ref: 50000 }
    ]
  }]);

  return [
    { cancel: 'all' },
    { side: 'buy', qty, type: 'smart', trigger: { type: 'stop', px: breakoutPx } }
  ];
}
