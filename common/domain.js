const ORDER_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  SHIPPED: 'shipped',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  AFTER_SALE_MANUAL: 'after_sale_manual'
};

const POINTS_LEDGER_TYPE = {
  EARN: 'earn',
  REDEEM: 'redeem',
  ADJUST: 'adjust',
  REFUND_MANUAL: 'refund_manual'
};

const COUPON_CLAIM_STATUS = {
  AVAILABLE: 'available',
  LOCKED: 'locked',
  USED: 'used',
  EXPIRED: 'expired'
};

const POINTS_PER_YUAN = 1;
const POINTS_REDEEM_PER_YUAN = 50;
const MAX_POINTS_REDEEM_RATE = 0.2;

function centsToYuan(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function clampInteger(value, min, max) {
  const n = Math.floor(Number(value || 0));
  return Math.max(min, Math.min(max, n));
}

function findSku(product, skuId) {
  return (product.skus || []).find((sku) => sku.id === skuId);
}

function calculatePointsRedemption({ pointsBalance, requestedPoints, goodsAmountCents }) {
  const maxDiscountCents = Math.floor(Number(goodsAmountCents || 0) * MAX_POINTS_REDEEM_RATE);
  const maxPointsByOrder = Math.floor(maxDiscountCents * POINTS_REDEEM_PER_YUAN / 100);
  const usedPoints = clampInteger(requestedPoints, 0, Math.min(Number(pointsBalance || 0), maxPointsByOrder));
  const discountCents = Math.floor(usedPoints * 100 / POINTS_REDEEM_PER_YUAN);
  return { usedPoints, discountCents };
}

function canUseCoupon({ couponClaim, goodsAmountCents, now = new Date() }) {
  if (!couponClaim) return { ok: true, reason: '' };
  if (couponClaim.status !== COUPON_CLAIM_STATUS.AVAILABLE) {
    return { ok: false, reason: '优惠券不可用' };
  }

  const coupon = couponClaim.coupon || {};
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: '优惠券已过期' };
  }
  if (Number(goodsAmountCents || 0) < Number(coupon.minSpendCents || 0)) {
    return { ok: false, reason: '未达到优惠券使用门槛' };
  }

  return { ok: true, reason: '' };
}

function calculateCouponDiscount({ couponClaim, goodsAmountCents, now }) {
  if (!couponClaim) return 0;
  const availability = canUseCoupon({ couponClaim, goodsAmountCents, now });
  if (!availability.ok) throw new Error(availability.reason);

  const coupon = couponClaim.coupon || {};
  if (coupon.type === 'amount_off') {
    return Math.min(Number(coupon.amountOffCents || 0), Number(goodsAmountCents || 0));
  }
  return 0;
}

function calculateOrderTotals({
  items,
  shippingRule,
  couponClaim,
  pointsBalance,
  requestedPoints,
  now = new Date()
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('请选择商品');
  }

  const lineItems = items.map(({ product, skuId, quantity }) => {
    if (!product || product.status !== 'on_sale') throw new Error('商品已下架');
    const sku = findSku(product, skuId);
    if (!sku) throw new Error('规格不存在');
    const safeQuantity = clampInteger(quantity, 1, 999);
    if (Number(sku.stock || 0) < safeQuantity) throw new Error('库存不足');
    const subtotalCents = Number(sku.priceCents || 0) * safeQuantity;
    return {
      productId: product.id,
      skuId,
      title: product.title,
      unitPriceCents: Number(sku.priceCents || 0),
      quantity: safeQuantity,
      subtotalCents
    };
  });

  const goodsAmountCents = lineItems.reduce((sum, item) => sum + item.subtotalCents, 0);
  const shippingFeeCents = goodsAmountCents >= Number(shippingRule.freeThresholdCents || 0)
    ? 0
    : Number(shippingRule.feeCents || 0);
  const couponDiscountCents = calculateCouponDiscount({ couponClaim, goodsAmountCents, now });
  const pointsBaseCents = Math.max(0, goodsAmountCents - couponDiscountCents);
  const redemption = calculatePointsRedemption({
    pointsBalance,
    requestedPoints,
    goodsAmountCents: pointsBaseCents
  });
  const payableAmountCents = Math.max(
    0,
    goodsAmountCents + shippingFeeCents - couponDiscountCents - redemption.discountCents
  );

  return {
    goodsAmountCents,
    shippingFeeCents,
    couponDiscountCents,
    pointsUsed: redemption.usedPoints,
    pointsDiscountCents: redemption.discountCents,
    payableAmountCents,
    earnPoints: Math.floor(payableAmountCents / 100) * POINTS_PER_YUAN,
    lineItems
  };
}

function applyPaidOrderEffects({ products, order, user, couponClaims, paidAt }) {
  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
    return { products, order, user, couponClaims, pointsLedger: [] };
  }

  const nextProducts = products.map((product) => ({
    ...product,
    skus: (product.skus || []).map((sku) => ({ ...sku }))
  }));
  const nextUser = { ...user };
  const nextCouponClaims = couponClaims.map((claim) => ({ ...claim }));
  const pointsLedger = [];

  order.items.forEach((item) => {
    const product = nextProducts.find((candidate) => candidate.id === item.productId);
    const sku = product && findSku(product, item.skuId);
    if (!sku || sku.stock < item.quantity) throw new Error('库存不足');
    sku.stock -= item.quantity;
  });

  if (order.pointsUsed > 0) {
    nextUser.pointsBalance -= order.pointsUsed;
    pointsLedger.push({
      userId: user.id,
      orderId: order.id,
      type: POINTS_LEDGER_TYPE.REDEEM,
      points: -order.pointsUsed,
      createdAt: paidAt
    });
  }

  if (order.earnPoints > 0) {
    nextUser.pointsBalance += order.earnPoints;
    pointsLedger.push({
      userId: user.id,
      orderId: order.id,
      type: POINTS_LEDGER_TYPE.EARN,
      points: order.earnPoints,
      createdAt: paidAt
    });
  }

  if (order.couponClaimId) {
    const claim = nextCouponClaims.find((candidate) => candidate.id === order.couponClaimId);
    if (claim) claim.status = COUPON_CLAIM_STATUS.USED;
  }

  return {
    products: nextProducts,
    order: { ...order, status: ORDER_STATUS.PAID, paidAt },
    user: nextUser,
    couponClaims: nextCouponClaims,
    pointsLedger
  };
}

function releaseLockedCoupon(couponClaims, couponClaimId) {
  if (!couponClaimId) return couponClaims;
  return couponClaims.map((claim) => {
    if (claim.id !== couponClaimId || claim.status !== COUPON_CLAIM_STATUS.LOCKED) return claim;
    const next = { ...claim, status: COUPON_CLAIM_STATUS.AVAILABLE };
    delete next.lockedOrderId;
    return next;
  });
}

function cancelPendingOrder({ order, couponClaims, cancelledAt }) {
  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
    return { order, couponClaims };
  }

  return {
    order: { ...order, status: ORDER_STATUS.CANCELLED, cancelledAt },
    couponClaims: releaseLockedCoupon(couponClaims, order.couponClaimId)
  };
}

module.exports = {
  ORDER_STATUS,
  POINTS_LEDGER_TYPE,
  COUPON_CLAIM_STATUS,
  POINTS_PER_YUAN,
  POINTS_REDEEM_PER_YUAN,
  MAX_POINTS_REDEEM_RATE,
  centsToYuan,
  calculatePointsRedemption,
  calculateOrderTotals,
  applyPaidOrderEffects,
  cancelPendingOrder,
  releaseLockedCoupon,
  canUseCoupon
};
