const api = require('../../common/api');
const { money, dateText } = require('../../common/format');

Page({
  data: { orders: [], money, dateText },
  async onShow() {
    this.setData({ orders: await api.listOrders() });
  },
  goDetail(event) {
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${event.currentTarget.dataset.id}` });
  }
});
