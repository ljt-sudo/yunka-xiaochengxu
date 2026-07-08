const api = require('../../common/api');
const { money, dateText } = require('../../common/format');

Page({
  data: { order: null, money, dateText },
  async onLoad(options) {
    this.setData({ order: await api.getOrder(options.id) });
  },
  async payAgain() {
    await api.createPayment(this.data.order.id);
    await api.paymentCallback(this.data.order.id);
    this.setData({ order: await api.getOrder(this.data.order.id) });
  },
  async cancelOrder() {
    const order = await api.cancelOrder(this.data.order.id);
    this.setData({ order });
  },
  goSupport() {
    wx.navigateTo({ url: `/pages/support/support?orderId=${this.data.order.id}` });
  }
});
