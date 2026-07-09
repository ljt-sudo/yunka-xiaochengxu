const api = require('../../common/api');
const { money } = require('../../common/format');

Page({
  data: {
    product: null,
    sku: null,
    quantity: 1,
    money
  },
  async onLoad(options) {
    try {
      const product = await api.getProduct(options.id);
      this.setData({ product, sku: product && product.skus[0] });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },
  step(event) {
    const delta = Number(event.currentTarget.dataset.delta);
    this.setData({ quantity: Math.max(1, this.data.quantity + delta) });
  },
  async addCart() {
    await api.addToCart({
      productId: this.data.product.id,
      skuId: this.data.sku.id,
      quantity: this.data.quantity
    });
    wx.showToast({ title: '已加入购物车' });
  },
  async buyNow() {
    await this.addCart();
    wx.switchTab({ url: '/pages/cart/cart' });
  }
});
