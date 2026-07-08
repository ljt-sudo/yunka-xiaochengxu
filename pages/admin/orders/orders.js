const api = require('../../../common/api');

Page({
  data: {
    orders: [],
    expressCompany: '顺丰速运',
    expressNo: ''
  },
  onShow() {
    this.refresh();
  },
  async refresh() {
    this.setData({ orders: await api.listOrders() });
  },
  input(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value });
  },
  async ship(event) {
    await api.shipOrder({
      orderId: event.currentTarget.dataset.id,
      expressCompany: this.data.expressCompany,
      expressNo: this.data.expressNo || `SF${Date.now()}`
    });
    await this.refresh();
    wx.showToast({ title: '已发货' });
  }
});
