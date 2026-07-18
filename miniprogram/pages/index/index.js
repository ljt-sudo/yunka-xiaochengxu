const api = require('../../common/api');
const { money } = require('../../common/format');

Page({
  data: {
    products: [],
    heroProduct: null,
    coupon: null,
    money,
    orderSource: ''
  },
  onLoad(options) {
    // 捕获带参二维码场景值
    if (options.scene) {
      const scene = decodeURIComponent(options.scene);
      wx.setStorageSync('orderSource', scene);
      this.setData({ orderSource: scene });
      console.log('[QR来源]', scene);
    }
  },
  async onShow() {
    try {
      const [products, coupons] = await Promise.all([api.listProducts(), api.listCoupons()]);
      this.setData({
        products: products.slice(0, 2),
        heroProduct: products[0] || null,
        coupon: coupons[0] || null
      });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },
  goProducts() {
    wx.switchTab({ url: '/pages/products/products' });
  },
  goProduct(event) {
    wx.navigateTo({ url: `/pages/product/product?id=${event.currentTarget.dataset.id}` });
  },
  goCoupons() {
    wx.navigateTo({ url: '/pages/coupons/coupons' });
  },
  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },
  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  }
});
