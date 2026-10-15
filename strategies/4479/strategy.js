/*
 * @coinsori-strategy v1
 * name: EURUSD 4h 미국금리 레짐 눌림목
 * ex: forex
 * syms: EURUSD
 * interval: 4h
 * marketType: cfd
 * cash: 10000
 *
 * 무엇을 노리나: 미국 10년물 금리가 내려가는 국면에서는 달러에 약세 압력이 생기고
 * 유로/달러는 오르는 쪽으로 기울어진다. 그 국면에서만 상승 추세의 눌림을 산다.
 * 금리는 환율 차트에 안 보이는 정보라, 가격만 보는 전략과 다른 자리를 고른다.
 * (이 종목의 기존 기록 — 1h 돌파·런던 돌파는 실패로 닫혔고, 눌림목은 기대값 0 근처였다.
 *  달라진 것은 레짐 판정을 가격이 아니라 금리로 한다는 점 하나다.)
 *
 * 언제 사나 — 네 가지가 모두 맞을 때, 봉이 끝난 직후 한 번만 판단한다
 *   1) 미국 10년물 금리의 30일 변화가 음수       — 달러 약세 쪽 국면
 *   2) 가격이 200봉 평균 위                      — 큰 흐름이 상승
 *   3) 최근 6봉 안에 RSI(14)가 45 아래로 눌렸다   — 되돌림이 있었다
 *   4) 직전 봉이 양봉으로 마감                   — 되돌림이 돌아섰다
 * 언제 파나: 진입가 −2ATR 손절 / 진입가 +6ATR 목표(손실 1 : 이익 3). 둘 다 봉 마감에 판정.
 * 수량: 자산의 2%를 손절까지의 거리로 나눈 뒤, 거래 최소 단위로 내림한다.
 *
 * 언제 안 되나: 위험회피 장세에서는 미국 금리가 내리면서 달러도 같이 강해진다.
 *   그때 1번 조건이 반대로 작동한다. 횡보장에서도 눌림목 진입이 계속 손절에 걸린다.
 *
 * ※ 수량은 반드시 1,000 단위여야 한다. 1차 실행에서 9,358 단위로 사서 9,000 만 팔리고
 *   358 이 남았고, 그 조각이 최소 단위 미만이라 못 팔려 포지션이 끝까지 안 닫혔다.
 *   그래서 구간당 거래가 2건에 그쳤다. 아래 roundLot 이 그 재발을 막는다.
 * ※ 주문은 전부 시장가다. 외환 라이브가 시장가만 지원하므로 백테스트도 같게 맞췄다.
 *   손절·목표를 봉 마감에 판정하므로 실제보다 늦게 잡힌다 — 보수적인 쪽 오차다.
 * ※ 스프레드와 스왑(롤오버)은 데이터에 없다. 결과는 그만큼 좋게 나온다.
 */

var LOT_MIN  = 1000;   // 이 브로커(EURUSD)의 최소 주문 수량
var LOT_STEP = 1000;   // 주문 수량 단위

// 수량을 거래 단위로 내림한다. 최소 미만이면 0 (주문하지 않는다)
function roundLot(q) {
  if (!(q > 0)) return 0;
  var r = Math.floor(q / LOT_STEP) * LOT_STEP;
  return (r < LOT_MIN) ? 0 : r;
}

function onUpdate(ctx) {
  var s = ctx.state;

  // ── 봉 전환 감지. 형성 중인 봉 값으로 판단하지 않기 위해 마감값을 따로 굴린다 ──
  var newBar = (s.lastBarI !== ctx.i);
  if (newBar) {
    s.pRsi   = (s.sRsi   === undefined) ? null : s.sRsi;
    s.pAtr   = (s.sAtr   === undefined) ? null : s.sAtr;
    s.pSma   = (s.sSma   === undefined) ? null : s.sSma;
    s.pClose = (s.sClose === undefined) ? null : s.sClose;
    s.pOpen  = (s.sOpen  === undefined) ? null : s.sOpen;

    // 되돌림 표시 — 직전 봉 RSI 가 45 아래였으면 그 시점을 기억한다
    if (s.pRsi != null && s.pRsi < 45) s.dipI = ctx.i;

    s.lastBarI = ctx.i;
  }
  // 매 호출 덮어쓴다 — 한 봉의 마지막 기록이 곧 그 봉의 마감값이 된다
  s.sRsi = ctx.rsi(14);
  s.sAtr = ctx.atr(14);
  s.sSma = ctx.sma(200);
  var c = ctx.candle;
  if (c) { s.sClose = c.c; s.sOpen = c.o; }

  var pos = ctx.position || 0;

  // ── 보유 중 ──
  if (pos > 0) {
    // 체결된 실제 진입가로 손절·목표를 한 번 다시 잡는다(주문 낼 때 쓴 값은 직전 봉 종가였다)
    if (!s.armed) {
      var ep = ctx.entryPx;
      var a0 = s.pAtr;
      if (ep != null && ep > 0 && a0 != null && a0 > 0) {
        s.stopPx = ep - 2 * a0;
        s.tgtPx  = ep + 6 * a0;
        s.armed = true;
      }
    }

    if (s.stopPx != null && s.tgtPx != null) {
      ctx.watch([
        { side: 'sell', price: s.stopPx, trigger: 'below', qty: pos, note: '손절 — 진입가 −2ATR' },
        { side: 'sell', price: s.tgtPx,  trigger: 'above', qty: pos, note: '목표 — 진입가 +6ATR' }
      ]);
    }

    if (!newBar) return null;
    var px = s.pClose;
    if (px == null || s.stopPx == null) return null;

    if (px <= s.stopPx || px >= s.tgtPx) {
      // 보유분 전량을 거래 단위로 내려 판다. 내림 때문에 조각이 남지 않도록
      // 진입 수량 자체를 단위에 맞췄으므로 여기서는 pos 가 이미 단위의 배수다.
      var sellQty = roundLot(pos);
      if (sellQty <= 0) return null;          // 팔 수 없는 조각 — 주문을 내지 않는다
      s.exitI = ctx.i;
      s.armed = false;
      return { side: 'sell', qty: sellQty };
    }
    return null;
  }

  // ── 무포지션 ──
  s.stopPx = null; s.tgtPx = null; s.armed = false;
  ctx.watch([]);
  if (!newBar) return null;

  var blocked = s.blocked = s.blocked || {};

  // 청산 직후 6봉(하루) 쉬어간다 — 같은 자리에서 반복해 얻어맞지 않도록
  if (s.exitI != null && (ctx.i - s.exitI) < 6) { blocked.cooldown = (blocked.cooldown || 0) + 1; return null; }

  var rsi = s.pRsi, atr = s.pAtr, sma = s.pSma, close = s.pClose, open = s.pOpen;
  if (rsi == null || atr == null || sma == null || close == null || open == null || !(atr > 0)) {
    blocked.warmup = (blocked.warmup || 0) + 1; return null;
  }

  // 1) 미국 10년물 금리 레짐 — 가격에 안 보이는 입력
  var ust = ctx.macro('ust10y');
  if (!ust || ust.chg30d == null) { blocked.macroNull = (blocked.macroNull || 0) + 1; return null; }
  if (ust.chg30d >= 0) { blocked.rateUp = (blocked.rateUp || 0) + 1; return null; }

  // 2) 큰 흐름이 상승
  if (close <= sma) { blocked.noTrend = (blocked.noTrend || 0) + 1; return null; }

  // 3) 최근 6봉 안에 눌림이 있었다
  if (s.dipI == null || (ctx.i - s.dipI) > 6) { blocked.noDip = (blocked.noDip || 0) + 1; return null; }

  // 4) 직전 봉이 양봉 — 되돌림이 돌아섰다
  if (close <= open) { blocked.noTurn = (blocked.noTurn || 0) + 1; return null; }

  // ── 수량 ──
  // 자산의 2%를 손절까지의 거리로 나눈다. 그 뒤 반드시 거래 단위로 내린다.
  var stopDist = 2 * atr;
  var equity = ctx.cash;
  var qty = (equity * 0.02) / stopDist;

  // 증거금 한도 — 노출이 자산의 5배를 넘지 않게. 엔진이 현금 한도로 자르면
  // 리스크 계산이 깨지므로(1차 실행에서 23,438 이 9,358 로 잘렸다) 여기서 먼저 막는다.
  var maxQty = (equity / close) * 5;
  if (qty > maxQty) qty = maxQty;

  qty = roundLot(qty);
  if (qty <= 0) { blocked.belowMinLot = (blocked.belowMinLot || 0) + 1; return null; }

  s.stopPx = close - stopDist;
  s.tgtPx  = close + 6 * atr;
  s.armed = false;     // 체결되면 실제 진입가로 다시 잡는다
  s.dipI = null;       // 같은 눌림으로 두 번 들어가지 않는다

  if (ctx.i % 500 === 0) ctx.log('blocked', JSON.stringify(blocked));
  return { side: 'buy', qty: qty };
}
