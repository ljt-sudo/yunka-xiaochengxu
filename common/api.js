const store = require('./store');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeId(value) {
  if (Array.isArray(value)) return value.map(normalizeId);
  if (!value || typeof value !== 'object') return value;

  const next = {};
  Object.keys(value).forEach((key) => {
    next[key] = normalizeId(value[key]);
  });
  if (next._id && !next.id) next.id = next._id;
  return next;
}

function canUseCloud() {
  return typeof wx !== 'undefined'
    && wx.cloud
    && typeof wx.cloud.callFunction === 'function';
}

function callCloud(action, payload) {
  return wx.cloud.callFunction({
    name: 'api',
    data: { action, payload: payload || {} }
  }).then((res) => {
    const body = res.result || {};
    if (!body.ok) throw new Error(body.error || '云函数调用失败');
    return normalizeId(body.data);
  });
}

function run(action, payload, fallback) {
  if (canUseCloud()) {
    return callCloud(action, payload).catch((error) => {
      console.warn(`[cloud fallback] ${action}:`, error.message || error);
      return normalizeId(fallback());
    });
  }
  return Promise.resolve(normalizeId(fallback()));
}

function localState() {
  return clone(store.loadState());
}

module.exports = {
  login() {
    return run('login', {}, () => store.login());
  },
  listProducts() {
    return run('listProducts', {}, () => store.listProducts());
  },
  listAllProducts() {
    return run('listAllProducts', {}, () => store.listAllProducts());
  },
  getProduct(id) {
    return run('getProduct', { id }, () => store.getProduct(id));
  },
  getSettings() {
    return run('getSettings', {}, () => store.getSettings());
  },
  getMemberData() {
    return run('getMemberData', {}, () => store.getMemberData());
  },
  getAdminData() {
    return run('getAdminData', {}, () => store.getAdminData());
  },
  addToCart(payload) {
    return run('addToCart', payload, () => store.addToCart(payload));
  },
  updateCartQuantity(payload) {
    return run('updateCartQuantity', payload, () => store.updateCartQuantity(payload.cartId, payload.quantity));
  },
  getCartDetails() {
    return run('getCartDetails', {}, () => store.getCartDetails());
  },
  listCoupons() {
    return run('listCoupons', {}, () => store.listCoupons());
  },
  claimCoupon(couponId) {
    return run('claimCoupon', { couponId }, () => store.claimCoupon(couponId));
  },
  listCouponClaims() {
    return run('listCouponClaims', {}, () => store.listCouponClaims());
  },
  previewOrder(payload) {
    return run('previewOrder', payload, () => store.previewOrder(payload));
  },
  createOrder(payload) {
    return run('createOrder', payload, () => store.createOrder(payload));
  },
  createPayment(orderId) {
    return run('createPayment', { orderId }, () => store.createPayment({ orderId }));
  },
  paymentCallback(orderId) {
    return run('paymentCallback', { orderId }, () => store.paymentCallback({ orderId }));
  },
  cancelOrder(orderId) {
    return run('cancelOrder', { orderId }, () => store.cancelOrder(orderId));
  },
  listOrders() {
    return run('listOrders', {}, () => store.listOrders());
  },
  getOrder(orderId) {
    return run('getOrder', { orderId }, () => store.getOrder(orderId));
  },
  shipOrder(payload) {
    return run('shipOrder', payload, () => store.shipOrder(payload));
  },
  adjustPoints(payload) {
    return run('adjustPoints', payload, () => store.adjustPoints(payload));
  },
  saveProduct(product) {
    return run('saveProduct', { product }, () => store.saveProduct(product));
  },
  saveCoupon(coupon) {
    return run('saveCoupon', { coupon }, () => store.saveCoupon(coupon));
  },
  saveSubscribeTask(task) {
    return run('saveSubscribeTask', task, () => store.saveSubscribeTask(task));
  },
  sendSubscribeTask(taskId) {
    return run('sendSubscribeTask', { taskId }, () => store.sendSubscribeTask({ taskId }));
  },
  resetDemo() {
    return Promise.resolve(store.resetState());
  },
  localState
};
