const assert = require('node:assert/strict');
const test = require('node:test');

const storage = {};
global.wx = {
  getStorageSync(key) {
    return storage[key];
  },
  setStorageSync(key, value) {
    storage[key] = value;
  }
};

const store = require('../miniprogram/common/store');

test('local commerce flow locks coupon, releases it on cancel, and applies paid effects once', () => {
  store.resetState();
  store.addToCart({ productId: 'jasmine-latte', skuId: 'jasmine-10', quantity: 1 });
  const cart = store.getCartDetails();
  const coupon = store.listCouponClaims().find((claim) => claim.status === 'available');

  const order = store.createOrder({
    cartIds: cart.map((item) => item.id),
    couponClaimId: coupon.id,
    requestedPoints: 250,
    address: { name: '测试用户', phone: '13800000000', detail: '测试地址' }
  });
  assert.equal(store.listCouponClaims().find((claim) => claim.id === coupon.id).status, 'locked');

  const cancelled = store.cancelOrder(order.id);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(store.listCouponClaims().find((claim) => claim.id === coupon.id).status, 'available');

  store.addToCart({ productId: 'jasmine-latte', skuId: 'jasmine-10', quantity: 1 });
  const paidOrder = store.createOrder({
    cartIds: store.getCartDetails().map((item) => item.id),
    couponClaimId: coupon.id,
    requestedPoints: 250,
    address: { name: '测试用户', phone: '13800000000', detail: '测试地址' }
  });
  const paid = store.paymentCallback({ orderId: paidOrder.id });
  const state = store.loadState();

  assert.equal(paid.status, 'paid');
  assert.equal(state.products.find((product) => product.id === 'jasmine-latte').skus[0].stock, 87);
  assert.equal(state.couponClaims.find((claim) => claim.id === coupon.id).status, 'used');
  assert.ok(state.pointsLedger.some((entry) => entry.type === 'earn'));
  assert.ok(state.pointsLedger.some((entry) => entry.type === 'redeem'));
});
