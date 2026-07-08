const seedData = require('./mock-data');
const {
  ORDER_STATUS,
  COUPON_CLAIM_STATUS,
  POINTS_LEDGER_TYPE,
  calculateOrderTotals,
  applyPaidOrderEffects,
  cancelPendingOrder
} = require('./domain');
const { id } = require('./format');

const STORAGE_KEY = 'yunkapuzi_mvp_state_v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  const saved = wx.getStorageSync(STORAGE_KEY);
  if (saved) return saved;
  const initial = clone(seedData);
  wx.setStorageSync(STORAGE_KEY, initial);
  return initial;
}

function saveState(state) {
  wx.setStorageSync(STORAGE_KEY, state);
  return state;
}

function resetState() {
  return saveState(clone(seedData));
}

function productWithSku(productId, skuId) {
  const state = loadState();
  const product = state.products.find((item) => item.id === productId);
  const sku = product && product.skus.find((item) => item.id === skuId);
  return { state, product, sku };
}

function listProducts() {
  return loadState().products.filter((product) => product.status === 'on_sale');
}

function listAllProducts() {
  return loadState().products;
}

function getProduct(idValue) {
  return loadState().products.find((product) => product.id === idValue);
}

function login() {
  return loadState().user;
}

function getSettings() {
  return loadState().settings;
}

function listCoupons() {
  return loadState().coupons;
}

function addToCart({ productId, skuId, quantity = 1 }) {
  const state = loadState();
  const found = productWithSku(productId, skuId);
  if (!found.product || !found.sku) throw new Error('商品规格不存在');
  const existing = state.cart.find((item) => item.productId === productId && item.skuId === skuId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    state.cart.push({ id: id('cart'), productId, skuId, quantity });
  }
  return saveState(state).cart;
}

function updateCartQuantity(cartId, quantity) {
  const state = loadState();
  const safeQuantity = Math.max(0, Number(quantity || 0));
  state.cart = state.cart
    .map((item) => (item.id === cartId ? { ...item, quantity: safeQuantity } : item))
    .filter((item) => item.quantity > 0);
  return saveState(state).cart;
}

function clearCart(cartIds) {
  const state = loadState();
  state.cart = state.cart.filter((item) => !cartIds.includes(item.id));
  saveState(state);
}

function getCartDetails() {
  const state = loadState();
  return state.cart.map((item) => {
    const product = state.products.find((candidate) => candidate.id === item.productId);
    const sku = product && product.skus.find((candidate) => candidate.id === item.skuId);
    return { ...item, product, sku, subtotalCents: sku ? sku.priceCents * item.quantity : 0 };
  }).filter((item) => item.product && item.sku);
}

function claimCoupon(couponId) {
  const state = loadState();
  const exists = state.couponClaims.some((claim) => claim.couponId === couponId && claim.status === COUPON_CLAIM_STATUS.AVAILABLE);
  if (!exists) {
    state.couponClaims.push({
      id: id('claim'),
      userId: state.user.id,
      couponId,
      status: COUPON_CLAIM_STATUS.AVAILABLE,
      claimedAt: new Date().toISOString()
    });
  }
  return saveState(state).couponClaims;
}

function listCouponClaims() {
  const state = loadState();
  return state.couponClaims.map((claim) => ({
    ...claim,
    coupon: state.coupons.find((coupon) => coupon.id === claim.couponId)
  }));
}

function previewOrder({ cartIds, couponClaimId, requestedPoints }) {
  const state = loadState();
  const selected = state.cart.filter((item) => cartIds.includes(item.id));
  const items = selected.map((item) => ({
    product: state.products.find((product) => product.id === item.productId),
    skuId: item.skuId,
    quantity: item.quantity
  }));
  const couponClaim = couponClaimId
    ? listCouponClaims().find((claim) => claim.id === couponClaimId)
    : null;

  return calculateOrderTotals({
    items,
    shippingRule: state.settings.shippingRule,
    couponClaim,
    pointsBalance: state.user.pointsBalance,
    requestedPoints
  });
}

function previewOrderItems({ items, couponClaimId, requestedPoints }) {
  const state = loadState();
  const couponClaim = couponClaimId
    ? listCouponClaims().find((claim) => claim.id === couponClaimId)
    : null;
  return calculateOrderTotals({
    items: items.map((item) => ({
      product: state.products.find((product) => product.id === item.productId),
      skuId: item.skuId,
      quantity: item.quantity
    })),
    shippingRule: state.settings.shippingRule,
    couponClaim,
    pointsBalance: state.user.pointsBalance,
    requestedPoints
  });
}

function createOrder({ cartIds, couponClaimId, requestedPoints, address }) {
  const state = loadState();
  const selected = state.cart.filter((item) => cartIds.includes(item.id));
  if (selected.length === 0) throw new Error('购物车为空');

  const couponClaim = couponClaimId
    ? state.couponClaims.map((claim) => ({ ...claim, coupon: state.coupons.find((coupon) => coupon.id === claim.couponId) })).find((claim) => claim.id === couponClaimId)
    : null;
  const totals = calculateOrderTotals({
    items: selected.map((item) => ({
      product: state.products.find((product) => product.id === item.productId),
      skuId: item.skuId,
      quantity: item.quantity
    })),
    shippingRule: state.settings.shippingRule,
    couponClaim,
    pointsBalance: state.user.pointsBalance,
    requestedPoints
  });

  const now = new Date().toISOString();
  const order = {
    id: id('order'),
    orderNo: `YK${Date.now()}`,
    status: ORDER_STATUS.PENDING_PAYMENT,
    items: totals.lineItems,
    address,
    couponClaimId: couponClaim ? couponClaim.id : '',
    createdAt: now,
    ...totals
  };

  if (couponClaim) {
    const claim = state.couponClaims.find((item) => item.id === couponClaim.id);
    claim.status = COUPON_CLAIM_STATUS.LOCKED;
    claim.lockedOrderId = order.id;
  }

  state.orders.unshift(order);
  state.cart = state.cart.filter((item) => !cartIds.includes(item.id));
  saveState(state);
  return order;
}

function mockPayOrder(orderId) {
  const state = loadState();
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('订单不存在');
  const result = applyPaidOrderEffects({
    products: state.products,
    order,
    user: state.user,
    couponClaims: state.couponClaims,
    paidAt: new Date().toISOString()
  });
  state.products = result.products;
  state.user = result.user;
  state.couponClaims = result.couponClaims;
  state.pointsLedger = result.pointsLedger.map((entry) => ({ id: id('pl'), ...entry })).concat(state.pointsLedger);
  state.orders = state.orders.map((item) => (item.id === orderId ? result.order : item));
  return saveState(state).orders.find((item) => item.id === orderId);
}

function createPayment({ orderId }) {
  const order = getOrder(orderId);
  if (!order || order.status !== ORDER_STATUS.PENDING_PAYMENT) throw new Error('订单状态不可支付');
  return {
    mode: 'mock_until_merchant_ready',
    orderId,
    orderNo: order.orderNo,
    amountCents: order.payableAmountCents,
    message: '开通微信支付商户号后，这里会调用微信支付。当前为开发预览模拟支付。'
  };
}

function paymentCallback({ orderId }) {
  return mockPayOrder(orderId);
}

function cancelOrder(orderId) {
  const state = loadState();
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('订单不存在');
  const result = cancelPendingOrder({
    order,
    couponClaims: state.couponClaims,
    cancelledAt: new Date().toISOString()
  });
  state.orders = state.orders.map((item) => (item.id === orderId ? result.order : item));
  state.couponClaims = result.couponClaims;
  return saveState(state).orders.find((item) => item.id === orderId);
}

function listOrders() {
  return loadState().orders;
}

function getOrder(orderId) {
  return loadState().orders.find((order) => order.id === orderId);
}

function shipOrder({ orderId, expressCompany, expressNo }) {
  const state = loadState();
  state.orders = state.orders.map((order) => {
    if (order.id !== orderId) return order;
    return {
      ...order,
      status: ORDER_STATUS.SHIPPED,
      expressCompany,
      expressNo,
      shippedAt: new Date().toISOString()
    };
  });
  return saveState(state).orders.find((order) => order.id === orderId);
}

function adjustPoints({ points, note }) {
  const state = loadState();
  const amount = Number(points || 0);
  state.user.pointsBalance += amount;
  state.pointsLedger.unshift({
    id: id('pl'),
    userId: state.user.id,
    type: POINTS_LEDGER_TYPE.ADJUST,
    points: amount,
    note,
    createdAt: new Date().toISOString()
  });
  return saveState(state).user;
}

function saveProduct(product) {
  const state = loadState();
  const index = state.products.findIndex((item) => item.id === product.id);
  if (index >= 0) {
    state.products[index] = product;
  } else {
    state.products.unshift(product);
  }
  return saveState(state).products;
}

function saveCoupon(coupon) {
  const state = loadState();
  const index = state.coupons.findIndex((item) => item.id === coupon.id);
  if (index >= 0) {
    state.coupons[index] = coupon;
  } else {
    state.coupons.unshift(coupon);
  }
  return saveState(state).coupons;
}

function saveSubscribeTask(task) {
  const state = loadState();
  state.subscribeTasks.unshift({ id: id('task'), status: 'draft', ...task });
  return saveState(state).subscribeTasks;
}

function sendSubscribeTask({ taskId }) {
  const state = loadState();
  const task = state.subscribeTasks.find((item) => item.id === taskId);
  if (!task) throw new Error('订阅任务不存在');
  return {
    taskId,
    status: 'ready_for_template_binding',
    scene: task.scene,
    message: '请在小程序后台配置模板 ID 并确认用户授权后再发送。'
  };
}

function getMemberData() {
  const state = loadState();
  return {
    user: state.user,
    pointsLedger: state.pointsLedger,
    settings: state.settings
  };
}

function getAdminData() {
  return loadState();
}

module.exports = {
  login,
  loadState,
  resetState,
  listProducts,
  listAllProducts,
  getProduct,
  getSettings,
  listCoupons,
  addToCart,
  updateCartQuantity,
  clearCart,
  getCartDetails,
  claimCoupon,
  listCouponClaims,
  previewOrder,
  previewOrderItems,
  createOrder,
  createPayment,
  paymentCallback,
  cancelOrder,
  mockPayOrder,
  listOrders,
  getOrder,
  shipOrder,
  adjustPoints,
  saveProduct,
  saveCoupon,
  saveSubscribeTask,
  sendSubscribeTask,
  getMemberData,
  getAdminData
};
