const { ORDER_STATUS, COUPON_CLAIM_STATUS } = require('./domain');

const now = '2026-07-06T09:00:00.000Z';

module.exports = {
  settings: {
    shippingRule: {
      feeCents: 800,
      freeThresholdCents: 9900
    },
    points: {
      earnText: '实付 1 元得 1 积分',
      redeemText: '50 积分抵 1 元，单笔最多抵商品金额 20%'
    },
    support: {
      phone: '待填写',
      wechat: '待填写',
      serviceText: '售后退款由客服人工处理，确认后在微信支付商户后台退款。'
    },
    subscribeTemplates: {
      couponArrived: '待配置优惠券到账模板 ID',
      repurchaseReminder: '待配置复购提醒模板 ID',
      pointsChanged: '待配置积分变动模板 ID'
    }
  },
  products: [
    {
      id: 'jasmine-latte',
      title: '茉莉花茶拿铁',
      subtitle: '花香轻盈，奶咖顺滑，每杯约 65 卡',
      status: 'on_sale',
      category: '即溶茶咖',
      cover: '/assets/products/jasmine-latte.jpg',
      detailImages: ['/assets/products/jasmine-latte.jpg'],
      tags: ['低卡', '冷热皆可', '独立条装'],
      description: '适合办公室、读书和加班场景的一杯轻负担茶咖。',
      skus: [
        { id: 'jasmine-10', name: '10 条装', priceCents: 6900, stock: 88 }
      ]
    },
    {
      id: 'bushao-drip',
      title: '卜少挂耳咖啡',
      subtitle: '精品挂耳礼袋装，适合日常口粮与伴手礼',
      status: 'on_sale',
      category: '挂耳咖啡',
      cover: '/assets/products/bushao-drip.jpg',
      detailImages: ['/assets/products/bushao-drip.jpg'],
      tags: ['精品挂耳', '礼袋', '中度烘焙'],
      description: '不用器具也能喝到干净稳定的精品咖啡风味。',
      skus: [
        { id: 'bushao-gift', name: '礼袋装', priceCents: 8900, stock: 56 }
      ]
    }
  ],
  user: {
    id: 'u_demo',
    nickname: '云咖会员',
    phone: '',
    pointsBalance: 1280,
    isAdmin: true,
    subscribeGranted: {
      couponArrived: false,
      repurchaseReminder: false,
      pointsChanged: false
    }
  },
  cart: [],
  orders: [
    {
      id: 'order_sample',
      orderNo: 'YK202607060001',
      status: ORDER_STATUS.SHIPPED,
      items: [
        {
          productId: 'jasmine-latte',
          skuId: 'jasmine-10',
          title: '茉莉花茶拿铁',
          unitPriceCents: 6900,
          quantity: 1,
          subtotalCents: 6900
        }
      ],
      goodsAmountCents: 6900,
      shippingFeeCents: 800,
      couponDiscountCents: 1000,
      pointsUsed: 250,
      pointsDiscountCents: 500,
      payableAmountCents: 6200,
      earnPoints: 62,
      createdAt: now,
      paidAt: now,
      shippedAt: now,
      expressCompany: '顺丰速运',
      expressNo: 'SF0000000001',
      address: {
        name: '体验用户',
        phone: '13800000000',
        detail: '海南省海口市云咖铺子体验地址'
      }
    }
  ],
  coupons: [
    {
      id: 'new_10',
      title: '新客精品咖啡券',
      type: 'amount_off',
      amountOffCents: 1000,
      minSpendCents: 5000,
      expiresAt: '2099-01-01T00:00:00.000Z',
      status: 'active'
    },
    {
      id: 'return_15',
      title: '老客复购券',
      type: 'amount_off',
      amountOffCents: 1500,
      minSpendCents: 9900,
      expiresAt: '2099-01-01T00:00:00.000Z',
      status: 'active'
    }
  ],
  couponClaims: [
    {
      id: 'claim_new_10',
      userId: 'u_demo',
      couponId: 'new_10',
      status: COUPON_CLAIM_STATUS.AVAILABLE,
      claimedAt: now
    }
  ],
  pointsLedger: [
    {
      id: 'pl_sample_earn',
      userId: 'u_demo',
      orderId: 'order_sample',
      type: 'earn',
      points: 62,
      createdAt: now
    },
    {
      id: 'pl_sample_redeem',
      userId: 'u_demo',
      orderId: 'order_sample',
      type: 'redeem',
      points: -250,
      createdAt: now
    }
  ],
  subscribeTasks: [
    {
      id: 'task_return_coupon',
      title: '复购券到账提醒',
      scene: 'couponArrived',
      status: 'draft',
      couponId: 'return_15',
      audience: 'paid_users',
      scheduledAt: ''
    }
  ],
  adminUsers: ['u_demo']
};
