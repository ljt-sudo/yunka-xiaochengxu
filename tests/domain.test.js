const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculatePointsRedemption,
  calculateOrderTotals,
  applyPaidOrderEffects,
  cancelPendingOrder,
  canUseCoupon,
  ORDER_STATUS,
  POINTS_LEDGER_TYPE,
  COUPON_CLAIM_STATUS
} = require('../miniprogram/common/domain');

test('points redemption uses 50 points per yuan and caps at 20 percent of goods amount', () => {
  assert.deepEqual(calculatePointsRedemption({
    pointsBalance: 5000,
    requestedPoints: 2000,
    goodsAmountCents: 4800
  }), {
    usedPoints: 480,
    discountCents: 960
  });
});

test('cancel pending order releases locked coupon without changing paid orders', () => {
  const lockedClaims = [{ id: 'cc1', status: COUPON_CLAIM_STATUS.LOCKED, lockedOrderId: 'o1' }];
  const pending = {
    id: 'o1',
    status: ORDER_STATUS.PENDING_PAYMENT,
    couponClaimId: 'cc1'
  };

  const cancelled = cancelPendingOrder({
    order: pending,
    couponClaims: lockedClaims,
    cancelledAt: '2026-07-06T00:02:00.000Z'
  });

  assert.equal(cancelled.order.status, ORDER_STATUS.CANCELLED);
  assert.equal(cancelled.couponClaims[0].status, COUPON_CLAIM_STATUS.AVAILABLE);
  assert.equal(cancelled.couponClaims[0].lockedOrderId, undefined);

  const paid = cancelPendingOrder({
    order: { ...pending, status: ORDER_STATUS.PAID },
    couponClaims: lockedClaims,
    cancelledAt: '2026-07-06T00:03:00.000Z'
  });

  assert.equal(paid.order.status, ORDER_STATUS.PAID);
  assert.equal(paid.couponClaims[0].status, COUPON_CLAIM_STATUS.LOCKED);
});

test('order totals include shipping, coupon discount, and points discount without going below zero', () => {
  const product = {
    id: 'p1',
    title: '茉莉花茶拿铁',
    status: 'on_sale',
    skus: [{ id: 's1', priceCents: 6900, stock: 8 }]
  };
  const couponClaim = {
    id: 'cc1',
    status: COUPON_CLAIM_STATUS.AVAILABLE,
    coupon: {
      id: 'c1',
      type: 'amount_off',
      amountOffCents: 1000,
      minSpendCents: 5000,
      expiresAt: '2099-01-01T00:00:00.000Z'
    }
  };

  assert.deepEqual(calculateOrderTotals({
    items: [{ product, skuId: 's1', quantity: 1 }],
    shippingRule: { feeCents: 800, freeThresholdCents: 9900 },
    couponClaim,
    pointsBalance: 2000,
    requestedPoints: 2000,
    now: new Date('2026-07-06T00:00:00.000Z')
  }), {
    goodsAmountCents: 6900,
    shippingFeeCents: 800,
    couponDiscountCents: 1000,
    pointsUsed: 590,
    pointsDiscountCents: 1180,
    payableAmountCents: 5520,
    earnPoints: 55,
    lineItems: [{
      productId: 'p1',
      skuId: 's1',
      title: '茉莉花茶拿铁',
      unitPriceCents: 6900,
      quantity: 1,
      subtotalCents: 6900
    }]
  });
});

test('coupon cannot be used when expired, unavailable, or below minimum spend', () => {
  const coupon = {
    id: 'c1',
    type: 'amount_off',
    amountOffCents: 1000,
    minSpendCents: 5000,
    expiresAt: '2026-01-01T00:00:00.000Z'
  };

  assert.equal(canUseCoupon({
    couponClaim: { status: COUPON_CLAIM_STATUS.AVAILABLE, coupon },
    goodsAmountCents: 8000,
    now: new Date('2026-07-06T00:00:00.000Z')
  }).ok, false);

  assert.equal(canUseCoupon({
    couponClaim: { status: COUPON_CLAIM_STATUS.LOCKED, coupon: { ...coupon, expiresAt: '2099-01-01T00:00:00.000Z' } },
    goodsAmountCents: 8000,
    now: new Date('2026-07-06T00:00:00.000Z')
  }).ok, false);

  assert.equal(canUseCoupon({
    couponClaim: { status: COUPON_CLAIM_STATUS.AVAILABLE, coupon: { ...coupon, expiresAt: '2099-01-01T00:00:00.000Z' } },
    goodsAmountCents: 3000,
    now: new Date('2026-07-06T00:00:00.000Z')
  }).ok, false);
});

test('paid order effects are idempotent, deduct stock, add points, and mark coupon used', () => {
  const products = [{
    id: 'p1',
    skus: [{ id: 's1', stock: 3 }]
  }];
  const order = {
    id: 'o1',
    status: ORDER_STATUS.PENDING_PAYMENT,
    items: [{ productId: 'p1', skuId: 's1', quantity: 2 }],
    earnPoints: 42,
    pointsUsed: 100,
    couponClaimId: 'cc1'
  };
  const user = { id: 'u1', pointsBalance: 500 };
  const couponClaims = [{ id: 'cc1', status: COUPON_CLAIM_STATUS.LOCKED }];

  const result = applyPaidOrderEffects({ products, order, user, couponClaims, paidAt: '2026-07-06T00:00:00.000Z' });

  assert.equal(result.order.status, ORDER_STATUS.PAID);
  assert.equal(result.products[0].skus[0].stock, 1);
  assert.equal(result.user.pointsBalance, 442);
  assert.equal(result.couponClaims[0].status, COUPON_CLAIM_STATUS.USED);
  assert.deepEqual(result.pointsLedger.map((entry) => entry.type), [
    POINTS_LEDGER_TYPE.REDEEM,
    POINTS_LEDGER_TYPE.EARN
  ]);

  const repeated = applyPaidOrderEffects({
    products: result.products,
    order: result.order,
    user: result.user,
    couponClaims: result.couponClaims,
    paidAt: '2026-07-06T00:01:00.000Z'
  });

  assert.equal(repeated.products[0].skus[0].stock, 1);
  assert.equal(repeated.user.pointsBalance, 442);
  assert.deepEqual(repeated.pointsLedger, []);
});
