const cloud = require('wx-server-sdk');
const {
  ORDER_STATUS,
  COUPON_CLAIM_STATUS,
  POINTS_LEDGER_TYPE,
  calculateOrderTotals,
  applyPaidOrderEffects,
  cancelPendingOrder
} = require('./domain');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

function ok(data) {
  return { ok: true, data };
}

function fail(error) {
  return { ok: false, error: error.message || String(error) };
}

function collection(name) {
  return db.collection(name);
}

async function getOpenId() {
  return cloud.getWXContext().OPENID;
}

async function requireAdmin(openid) {
  const result = await collection('admin_users').where({ openid, active: true }).limit(1).get();
  if (result.data.length === 0) throw new Error('无后台权限');
}

async function isAdmin(openid) {
  const result = await collection('admin_users').where({ openid, active: true }).limit(1).get();
  return result.data.length > 0;
}

function withId(doc) {
  return doc ? { ...doc, id: doc._id } : doc;
}

async function login() {
  const openid = await getOpenId();
  const users = collection('users');
  const found = await users.where({ openid }).limit(1).get();
  if (found.data[0]) return withId(found.data[0]);

  const user = {
    openid,
    nickname: '云咖会员',
    pointsBalance: 0,
    subscribeGranted: {},
    createdAt: new Date()
  };
  const created = await users.add({ data: user });
  return { _id: created._id, id: created._id, ...user };
}

async function listProducts() {
  const result = await collection('products').where({ status: 'on_sale' }).orderBy('sort', 'asc').get();
  return result.data.map(withId);
}

async function listAllProducts() {
  const openid = await getOpenId();
  await requireAdmin(openid);
  const result = await collection('products').orderBy('sort', 'asc').get();
  return result.data.map(withId);
}

async function getProduct({ id }) {
  const result = await collection('products').doc(id).get();
  return withId(result.data);
}

async function getSettings() {
  const result = await collection('settings').doc('commerce').get();
  return result.data;
}

async function listCoupons() {
  const result = await collection('coupons').where({ status: 'active' }).get();
  return result.data.map(withId);
}

async function listCouponClaims() {
  const openid = await getOpenId();
  const user = await login();
  const claims = await collection('coupon_claims').where({ userId: user.id }).get();
  const coupons = await collection('coupons').where({ status: 'active' }).get();
  const byId = {};
  coupons.data.forEach((coupon) => { byId[coupon._id] = withId(coupon); });
  return claims.data.map((claim) => ({ ...withId(claim), coupon: byId[claim.couponId], openid }));
}

async function claimCoupon({ couponId }) {
  const user = await login();
  const existing = await collection('coupon_claims')
    .where({ userId: user.id, couponId, status: COUPON_CLAIM_STATUS.AVAILABLE })
    .limit(1)
    .get();
  if (existing.data[0]) return existing.data[0];

  const claim = {
    userId: user.id,
    couponId,
    status: COUPON_CLAIM_STATUS.AVAILABLE,
    claimedAt: new Date()
  };
  const created = await collection('coupon_claims').add({ data: claim });
  return { _id: created._id, id: created._id, ...claim };
}

async function addToCart({ productId, skuId, quantity = 1 }) {
  const user = await login();
  const carts = collection('carts');
  const existing = await carts.where({ userId: user.id, productId, skuId }).limit(1).get();
  if (existing.data[0]) {
    await carts.doc(existing.data[0]._id).update({
      data: { quantity: _.inc(Number(quantity || 1)), updatedAt: new Date() }
    });
  } else {
    await carts.add({
      data: {
        userId: user.id,
        productId,
        skuId,
        quantity: Number(quantity || 1),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }
  return getCartDetails();
}

async function updateCartQuantity({ cartId, quantity }) {
  const user = await login();
  const safeQuantity = Math.max(0, Number(quantity || 0));
  const doc = await collection('carts').doc(cartId).get();
  if (doc.data.userId !== user.id) throw new Error('购物车商品不存在');
  if (safeQuantity === 0) {
    await collection('carts').doc(cartId).remove();
  } else {
    await collection('carts').doc(cartId).update({ data: { quantity: safeQuantity, updatedAt: new Date() } });
  }
  return getCartDetails();
}

async function getCartDetails() {
  const user = await login();
  const carts = await collection('carts').where({ userId: user.id }).get();
  if (carts.data.length === 0) return [];
  const products = await collection('products').where({
    _id: _.in(carts.data.map((item) => item.productId))
  }).get();
  const byId = {};
  products.data.forEach((product) => { byId[product._id] = withId(product); });
  return carts.data.map((item) => {
    const product = byId[item.productId];
    const sku = product && (product.skus || []).find((candidate) => candidate.id === item.skuId);
    return {
      ...withId(item),
      product,
      sku,
      subtotalCents: sku ? Number(sku.priceCents || 0) * Number(item.quantity || 0) : 0
    };
  }).filter((item) => item.product && item.sku);
}

async function buildOrderItems({ items, cartIds, user }) {
  if (Array.isArray(items) && items.length > 0) return items;
  const selected = cartIds && cartIds.length
    ? await collection('carts').where({ userId: user.id, _id: _.in(cartIds) }).get()
    : await collection('carts').where({ userId: user.id }).get();
  return selected.data.map((item) => ({
    cartId: item._id,
    productId: item.productId,
    skuId: item.skuId,
    quantity: item.quantity
  }));
}

async function previewOrder({ items, cartIds, couponClaimId, requestedPoints }) {
  const user = await login();
  const orderItems = await buildOrderItems({ items, cartIds, user });
  if (orderItems.length === 0) throw new Error('请选择商品');
  const settings = await collection('settings').doc('commerce').get();
  const productsResult = await collection('products').where({
    _id: _.in(orderItems.map((item) => item.productId))
  }).get();
  const productById = {};
  productsResult.data.forEach((product) => { productById[product._id] = withId(product); });

  let couponClaim = null;
  if (couponClaimId) {
    const claimDoc = await collection('coupon_claims').doc(couponClaimId).get();
    if (claimDoc.data.userId !== user.id) throw new Error('优惠券不可用');
    const couponDoc = await collection('coupons').doc(claimDoc.data.couponId).get();
    couponClaim = { ...withId(claimDoc.data), coupon: withId(couponDoc.data) };
  }

  return calculateOrderTotals({
    items: orderItems.map((item) => ({
      product: productById[item.productId],
      skuId: item.skuId,
      quantity: item.quantity
    })),
    shippingRule: settings.data.shippingRule,
    couponClaim,
    pointsBalance: user.pointsBalance,
    requestedPoints
  });
}

async function createOrder({ items, cartIds, couponClaimId, requestedPoints, address }) {
  const user = await login();
  const orderItems = await buildOrderItems({ items, cartIds, user });
  if (orderItems.length === 0) throw new Error('购物车为空');
  const settings = await collection('settings').doc('commerce').get();
  const productsResult = await collection('products').where({
    _id: _.in(orderItems.map((item) => item.productId))
  }).get();

  let couponClaim = null;
  if (couponClaimId) {
    const claimDoc = await collection('coupon_claims').doc(couponClaimId).get();
    if (claimDoc.data.userId !== user.id) throw new Error('优惠券不可用');
    const couponDoc = await collection('coupons').doc(claimDoc.data.couponId).get();
    couponClaim = { ...withId(claimDoc.data), coupon: withId(couponDoc.data) };
  }

  const productById = {};
  productsResult.data.forEach((product) => { productById[product._id] = withId(product); });
  const totals = calculateOrderTotals({
    items: orderItems.map((item) => ({
      product: productById[item.productId],
      skuId: item.skuId,
      quantity: item.quantity
    })),
    shippingRule: settings.data.shippingRule,
    couponClaim,
    pointsBalance: user.pointsBalance,
    requestedPoints
  });

  const order = {
    userId: user.id,
    openid: user.openid,
    orderNo: `YK${Date.now()}`,
    status: ORDER_STATUS.PENDING_PAYMENT,
    address,
    couponClaimId: couponClaimId || '',
    createdAt: new Date(),
    ...totals
  };
  const created = await collection('orders').add({ data: order });
  if (cartIds && cartIds.length) {
    await Promise.all(cartIds.map((cartId) => collection('carts').doc(cartId).remove().catch(() => null)));
  }
  if (couponClaimId) {
    await collection('coupon_claims').doc(couponClaimId).update({
      data: { status: COUPON_CLAIM_STATUS.LOCKED, lockedOrderId: created._id }
    });
  }
  return { _id: created._id, id: created._id, ...order };
}

async function createPayment({ orderId }) {
  const order = await collection('orders').doc(orderId).get();
  if (order.data.status !== ORDER_STATUS.PENDING_PAYMENT) throw new Error('订单状态不可支付');

  return {
    mode: 'mock_until_merchant_ready',
    orderId,
    orderNo: order.data.orderNo,
    amountCents: order.data.payableAmountCents,
    message: '开通微信支付商户号后，在此云函数中替换为真实小程序支付参数。'
  };
}

async function paymentCallback({ orderId, transactionId }) {
  const orderDoc = await collection('orders').doc(orderId).get();
  const order = withId(orderDoc.data);
  const userDoc = await collection('users').doc(order.userId).get();
  const products = await collection('products').where({
    _id: _.in(order.items.map((item) => item.productId))
  }).get();
  const couponClaims = order.couponClaimId
    ? [(await collection('coupon_claims').doc(order.couponClaimId).get()).data]
    : [];
  const normalizedProducts = products.data.map((product) => ({ ...product, id: product._id }));
  const result = applyPaidOrderEffects({
    products: normalizedProducts,
    order,
    user: { ...userDoc.data, id: userDoc.data._id },
    couponClaims: couponClaims.map((claim) => ({ ...claim, id: claim._id })),
    paidAt: new Date()
  });

  await collection('orders').doc(orderId).update({
    data: { status: result.order.status, paidAt: result.order.paidAt, transactionId: transactionId || '' }
  });
  await collection('users').doc(order.userId).update({
    data: { pointsBalance: result.user.pointsBalance }
  });
  await Promise.all(result.products.map((product) => collection('products').doc(product.id).update({
    data: { skus: product.skus }
  })));
  await Promise.all(result.couponClaims.map((claim) => collection('coupon_claims').doc(claim.id).update({
    data: { status: claim.status }
  })));
  await Promise.all(result.pointsLedger.map((entry) => collection('points_ledger').add({ data: entry })));
  
  // 会员积分同步（不影响主流程）
  try {
    await earnPointsOnPayment({
      openid: order.openid,
      orderAmountCents: order.payableAmountCents || order.goodsAmountCents || 0,
      orderId
    });
  } catch (e) {
    console.error('Member points sync failed:', e);
  }
  
  return result.order;
}

async function markOrderPaid(payload) {
  return paymentCallback(payload);
}

async function cancelOrder({ orderId }) {
  const user = await login();
  const orderDoc = await collection('orders').doc(orderId).get();
  const order = withId(orderDoc.data);
  if (order.userId !== user.id) throw new Error('订单不存在');
  const couponClaims = order.couponClaimId
    ? [withId((await collection('coupon_claims').doc(order.couponClaimId).get()).data)]
    : [];
  const result = cancelPendingOrder({ order, couponClaims, cancelledAt: new Date() });
  await collection('orders').doc(orderId).update({
    data: { status: result.order.status, cancelledAt: result.order.cancelledAt }
  });
  await Promise.all(result.couponClaims.map((claim) => collection('coupon_claims').doc(claim.id).update({
    data: { status: claim.status, lockedOrderId: _.remove() }
  })));
  return result.order;
}

async function listOrders() {
  const openid = await getOpenId();
  const user = await login();
  const admin = await isAdmin(openid);
  const result = admin
    ? await collection('orders').orderBy('createdAt', 'desc').get()
    : await collection('orders').where({ userId: user.id }).orderBy('createdAt', 'desc').get();
  return result.data.map(withId);
}

async function getOrder({ orderId }) {
  const user = await login();
  const orderDoc = await collection('orders').doc(orderId).get();
  const order = withId(orderDoc.data);
  if (order.userId !== user.id && !(await isAdmin(await getOpenId()))) throw new Error('订单不存在');
  return order;
}

async function shipOrder({ orderId, expressCompany, expressNo }) {
  const openid = await getOpenId();
  await requireAdmin(openid);
  await collection('orders').doc(orderId).update({
    data: {
      status: ORDER_STATUS.SHIPPED,
      expressCompany,
      expressNo,
      shippedAt: new Date()
    }
  });
  return { orderId, expressCompany, expressNo };
}

async function adjustPoints({ userId, points, note }) {
  const openid = await getOpenId();
  await requireAdmin(openid);
  const amount = Number(points || 0);
  await collection('users').doc(userId).update({ data: { pointsBalance: _.inc(amount) } });
  await collection('points_ledger').add({
    data: {
      userId,
      type: POINTS_LEDGER_TYPE.ADJUST,
      points: amount,
      note,
      createdAt: new Date()
    }
  });
  return { userId, points: amount };
}

async function saveSubscribeTask(task) {
  const openid = await getOpenId();
  await requireAdmin(openid);
  const created = await collection('subscribe_tasks').add({
    data: {
      ...task,
      status: 'draft',
      createdAt: new Date()
    }
  });
  return { _id: created._id, ...task };
}

async function saveProduct({ product }) {
  const openid = await getOpenId();
  await requireAdmin(openid);
  const payload = { ...product };
  const productId = payload.id || payload._id;
  delete payload.id;
  delete payload._id;
  if (productId) {
    await collection('products').doc(productId).set({ data: payload });
    return { id: productId, ...payload };
  }
  const created = await collection('products').add({ data: payload });
  return { id: created._id, _id: created._id, ...payload };
}

async function saveCoupon({ coupon }) {
  const openid = await getOpenId();
  await requireAdmin(openid);
  const payload = { ...coupon };
  const couponId = payload.id || payload._id;
  delete payload.id;
  delete payload._id;
  if (couponId) {
    await collection('coupons').doc(couponId).set({ data: payload });
    return { id: couponId, ...payload };
  }
  const created = await collection('coupons').add({ data: payload });
  return { id: created._id, _id: created._id, ...payload };
}

async function getMemberData() {
  const user = await login();
  const settings = await getSettings();
  const ledger = await collection('points_ledger').where({ userId: user.id }).orderBy('createdAt', 'desc').get();
  return { user, settings, pointsLedger: ledger.data.map(withId) };
}

async function getAdminData() {
  const openid = await getOpenId();
  await requireAdmin(openid);
  const [products, coupons, orders, users, ledger, tasks, settings] = await Promise.all([
    collection('products').get(),
    collection('coupons').get(),
    collection('orders').orderBy('createdAt', 'desc').get(),
    collection('users').get(),
    collection('points_ledger').orderBy('createdAt', 'desc').get(),
    collection('subscribe_tasks').orderBy('createdAt', 'desc').get(),
    getSettings()
  ]);
  return {
    products: products.data.map(withId),
    coupons: coupons.data.map(withId),
    orders: orders.data.map(withId),
    users: users.data.map(withId),
    user: users.data[0] ? withId(users.data[0]) : null,
    pointsLedger: ledger.data.map(withId),
    subscribeTasks: tasks.data.map(withId),
    settings
  };
}

async function sendSubscribeTask({ taskId }) {
  const openid = await getOpenId();
  await requireAdmin(openid);
  const task = await collection('subscribe_tasks').doc(taskId).get();
  return {
    taskId,
    status: 'ready_for_template_binding',
    scene: task.data.scene,
    message: '请在小程序后台配置模板 ID 后，再启用批量发送。'
  };
}

// ===== 会员等级与积分系统 ====

const TIERS = {
  tier_green_bean: { level: 1, name: '青豆会员', multiplier: 1.0 },
  tier_silver_roast: { level: 2, name: '银焙会员', multiplier: 1.5 },
  tier_premium_gold: { level: 3, name: '臻金会员', multiplier: 2.0 }
};

async function getOrCreateMember() {
  const openid = await getOpenId();
  const found = await collection('members').where({ openid }).limit(1).get();
  if (found.data[0]) return withId(found.data[0]);
  const newMember = {
    openid,
    nickname: '云咖会员',
    avatar: '',
    tier: 'tier_green_bean',
    tierName: '青豆会员',
    totalPoints: 0,
    usedPoints: 0,
    totalSpendCents: 0,
    totalOrders: 0,
    birthday: '',
    createdAt: new Date(),
    lastVisitAt: new Date(),
    status: 'active'
  };
  const created = await collection('members').add({ data: newMember });
  return { _id: created._id, id: created._id, ...newMember };
}

async function getTierConfig() {
  const result = await collection('tier_config').get();
  return result.data.map(withId);
}

async function getMemberProfile() {
  const openid = await getOpenId();
  let member = await collection('members').where({ openid }).limit(1).get();
  if (!member.data[0]) member = await getOrCreateMember();
  else member = withId(member.data[0]);
  
  const tiers = await getTierConfig();
  const currentTier = tiers.find(t => t._id === member.tier) || tiers[0];
  const nextTier = tiers.find(t => t.level === (currentTier?.level || 0) + 1) || null;
  
  // 统计本月积分
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = await collection('points_log')
    .where({ openid, createdAt: _.gte(monthStart) })
    .get();
  const monthPoints = thisMonth.data.reduce((sum, r) => sum + r.amount, 0);
  
  return {
    member,
    currentTier,
    nextTier,
    monthPoints,
    upgradeProgress: nextTier ? {
      currentSpendCents: member.totalSpendCents,
      targetSpendCents: nextTier.conditions?.entryRequirements?.totalSpendCents || 0,
      percent: Math.min(100, Math.round(member.totalSpendCents / (nextTier.conditions?.entryRequirements?.totalSpendCents || 1) * 100))
    } : null
  };
}

async function getMemberBenefits() {
  const openid = await getOpenId();
  const now = new Date();
  const benefits = await collection('benefits')
    .where({ openid, status: 'active', validUntil: _.gte(now) })
    .orderBy('validFrom', 'asc')
    .get();
  return benefits.data.map(withId);
}

async function getPointsHistory({ limit = 20, offset = 0 }) {
  const openid = await getOpenId();
  const result = await collection('points_log')
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .skip(offset)
    .limit(Math.min(limit, 50))
    .get();
  return result.data.map(withId);
}

async function useBenefit({ benefitId }) {
  const openid = await getOpenId();
  const doc = await collection('benefits').doc(benefitId).get();
  if (!doc.data) throw new Error('权益不存在');
  if (doc.data.openid !== openid) throw new Error('无权操作此权益');
  if (doc.data.status !== 'active') throw new Error('权益已使用或已过期');
  if (new Date(doc.data.validUntil) < new Date()) throw new Error('权益已过期');
  await collection('benefits').doc(benefitId).update({
    data: { status: 'used', usedAt: new Date() }
  });
  return { benefitId, status: 'used' };
}

async function checkAndUpgrade() {
  const openid = await getOpenId();
  const member = await collection('members').where({ openid }).limit(1).get();
  if (!member.data[0]) return { upgraded: false, reason: '非会员用户' };
  const memberData = withId(member.data[0]);
  
  const tiers = await getTierConfig();
  const currentTier = tiers.find(t => t._id === memberData.tier);
  if (!currentTier) return { upgraded: false, reason: '等级配置异常' };
  
  const nextTier = tiers.find(t => t.level === currentTier.level + 1);
  if (!nextTier) return { upgraded: false, reason: '已达最高等级' };
  
  const entryReq = nextTier.conditions?.entryRequirements;
  if (!entryReq) return { upgraded: false, reason: '无升级条件配置' };
  
  const spendMet = memberData.totalSpendCents >= (entryReq.totalSpendCents || Infinity);
  if (!spendMet) {
    return {
      upgraded: false,
      reason: '消费未达标',
      requiredSpendCents: entryReq.totalSpendCents,
      currentSpendCents: memberData.totalSpendCents
    };
  }
  
  await collection('members').doc(memberData.id).update({
    data: {
      tier: nextTier._id,
      tierName: nextTier.name,
      lastVisitAt: new Date()
    }
  });
  
  return { upgraded: true, newTier: nextTier._id, newTierName: nextTier.name };
}

// ===== 激活支付时的会员积分处理 =====

async function earnPointsOnPayment({ openid, orderAmountCents, orderId }) {
  const member = await collection('members').where({ openid }).limit(1).get();
  if (!member.data[0]) return null;
  const m = member.data[0];
  const tier = TIERS[m.tier] || TIERS.tier_green_bean;
  const points = Math.floor(orderAmountCents / 100 * tier.multiplier);
  
  // 更新会员积分
  await collection('members').doc(m._id).update({
    data: {
      totalPoints: _.inc(points),
      totalSpendCents: _.inc(orderAmountCents),
      totalOrders: _.inc(1),
      lastVisitAt: new Date()
    }
  });
  
  // 记录积分流水
  await collection('points_log').add({
    data: {
      openid,
      type: 'earn',
      amount: points,
      balance: m.totalPoints + points,
      source: 'order',
      sourceId: orderId,
      remark: `消费 ${(orderAmountCents/100).toFixed(2)} 元（${tier.name} ${tier.multiplier} 倍）得 ${points} 积分`,
      createdAt: new Date()
    }
  });
  
  // 自动检查升级
  try {
    const tiers = await collection('tier_config').get();
    const currentTierConfig = tiers.data.find(t => t._id === m.tier);
    const nextTierConfig = tiers.data.find(t => t.level === (currentTierConfig?.level || 0) + 1);
    if (nextTierConfig) {
      const entryReq = nextTierConfig.conditions?.entryRequirements;
      const newTotalSpend = m.totalSpendCents + orderAmountCents;
      if (entryReq && newTotalSpend >= (entryReq.totalSpendCents || Infinity)) {
        await collection('members').doc(m._id).update({
          data: { tier: nextTierConfig._id, tierName: nextTierConfig.name }
        });
      }
    }
  } catch (e) {
    // 升级失败不影响主流程
    console.error('Auto upgrade failed:', e);
  }
  
  return { points, multiplier: tier.multiplier };
}

// ===== 管理后台接口 =====

async function getMembers() {
  const openid = await getOpenId();
  await requireAdmin(openid);
  const result = await collection('members').orderBy('createdAt', 'desc').get();
  return result.data.map(withId);
}

async function updateMemberTier({ memberId, tierId }) {
  const openid = await getOpenId();
  await requireAdmin(openid);
  const tier = await collection('tier_config').doc(tierId).get();
  if (!tier.data) throw new Error('等级不存在');
  await collection('members').doc(memberId).update({
    data: { tier: tierId, tierName: tier.data.name }
  });
  return { memberId, tier: tierId, tierName: tier.data.name };
}

async function updateTierConfig({ tier }) {
  const openid = await getOpenId();
  await requireAdmin(openid);
  const payload = { ...tier };
  const id = payload._id;
  delete payload._id;
  delete payload.id;
  await collection('tier_config').doc(id).set({ data: payload });
  return { id, ...payload };
}

async function createBenefit({ desc, tierSource }) {
  const openid = await getOpenId();
  await requireAdmin(openid);
  // 获取该等级的所有会员
  const members = await collection('members').where({ tier: tierSource }).get();
  const now = new Date();
  const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30天后过期
  
  const benefits = members.data.map(m => ({
    openid: m.openid,
    type: 'admin_grant',
    title: desc || '管理员发放权益',
    description: desc || '',
    status: 'active',
    validFrom: now,
    validUntil,
    usedAt: null,
    grantedAt: now,
    tierSource
  }));
  
  if (benefits.length > 0) {
    // 批量插入（云数据库一次最多100条）
    for (const b of benefits) {
      await collection('benefits').add({ data: b });
    }
  }
  return { count: benefits.length, desc, tierSource };
}

async function saveSettings({ settings }) {
  const openid = await getOpenId();
  await requireAdmin(openid);
  await collection('settings').doc('commerce').set({ data: settings });
  return { ok: true };
}

exports.main = async (event) => {
  try {
    const action = event.action;
    const payload = event.payload || {};
    const handlers = {
      login,
      listProducts,
      listAllProducts,
      getProduct,
      getSettings,
      listCoupons,
      getMemberData,
      getAdminData,
      addToCart,
      updateCartQuantity,
      getCartDetails,
      listCouponClaims,
      claimCoupon,
      previewOrder,
      createOrder,
      createPayment,
      paymentCallback,
      markOrderPaid,
      cancelOrder,
      listOrders,
      getOrder,
      shipOrder,
      adjustPoints,
      saveProduct,
      saveCoupon,
      saveSubscribeTask,
      sendSubscribeTask,
      getTierConfig,
      getMemberProfile,
      getMemberBenefits,
      getPointsHistory,
      useBenefit,
      checkAndUpgrade,
      getMembers,
      updateMemberTier,
      updateTierConfig,
      createBenefit,
      saveSettings
    };
    if (!handlers[action]) throw new Error(`未知操作: ${action}`);
    return ok(await handlers[action](payload));
  } catch (error) {
    return fail(error);
  }
};
