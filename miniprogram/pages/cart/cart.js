const api = require('../../common/api');
const { money } = require('../../common/format');

Page({
  data: {
    items: [],
    goodsAmountCents: 0,
    money
  },
  onShow() {
    this.refresh();
  },
  async refresh() {
    const items = await api.getCartDetails();
    this.setData({
      items,
      goodsAmountCents: items.reduce((sum, item) => sum + item.subtotalCents, 0)
    });
  },
  async step(event) {
    const { id: cartId, delta } = event.currentTarget.dataset;
    const item = this.data.items.find((candidate) => candidate.id === cartId);
    await api.updateCartQuantity({ cartId, quantity: item.quantity + Number(delta) });
    await this.refresh();
  },
  checkout() {
    if (this.data.items.length === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/checkout/checkout' });
  }
});
