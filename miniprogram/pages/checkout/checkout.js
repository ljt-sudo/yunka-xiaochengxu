const api = require('../../common/api');
const { money } = require('../../common/format');

Page({
  data: {
    cartIds: [],
    items: [],
    couponClaims: [],
    selectedCouponClaimId: '',
    requestedPoints: 0,
    totals: null,
    address: {
      name: '体验用户',
      phone: '13800000000',
      detail: '海南省海口市云咖铺子体验地址'
    },
    error: '',
    money,
    agreed: false
  },
  async onShow() {
    try {
      const [items, claims] = await Promise.all([api.getCartDetails(), api.listCouponClaims()]);
      const couponClaims = claims.filter((claim) => claim.status === 'available');
      this.setData({
        items,
        cartIds: items.map((item) => item.id),
        couponClaims,
        selectedCouponClaimId: couponClaims[0] ? couponClaims[0].id : ''
      }, () => this.preview());
    } catch (error) {
      this.setData({ error: error.message, totals: null });
    }
  },
  async preview() {
    try {
      const totals = await api.previewOrder({
        cartIds: this.data.cartIds,
        couponClaimId: this.data.selectedCouponClaimId,
        requestedPoints: Number(this.data.requestedPoints || 0)
      });
      this.setData({ totals, error: '' });
    } catch (error) {
      this.setData({ error: error.message, totals: null });
    }
  },
  chooseCoupon(event) {
    this.setData({ selectedCouponClaimId: event.currentTarget.dataset.id }, () => this.preview());
  },
  inputPoints(event) {
    this.setData({ requestedPoints: event.detail.value }, () => this.preview());
  },
  inputAddress(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`address.${field}`]: event.detail.value });
  },
  async createOrder() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意服务协议和隐私政策', icon: 'none' });
      return;
    }
    try {
      const order = await api.createOrder({
        cartIds: this.data.cartIds,
        couponClaimId: this.data.selectedCouponClaimId,
        requestedPoints: Number(this.data.requestedPoints || 0),
        address: this.data.address,
        source: wx.getStorageSync('orderSource') || ''
      });
      const payment = await api.createPayment(order.id);
      wx.showModal({
        title: payment.mode === 'mock_until_merchant_ready' ? '开发预览支付' : '微信支付',
        content: payment.message || '请确认支付。',
        confirmText: '模拟支付',
        success: async (res) => {
          if (res.confirm) {
            await api.paymentCallback(order.id);
            wx.redirectTo({ url: `/pages/order-detail/order-detail?id=${order.id}` });
          } else {
            await api.cancelOrder(order.id);
            wx.redirectTo({ url: `/pages/order-detail/order-detail?id=${order.id}` });
          }
        }
      });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },
  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },
  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },
  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  }
});
