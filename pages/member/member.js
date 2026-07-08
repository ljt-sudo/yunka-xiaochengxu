const api = require('../../common/api');
const { dateText } = require('../../common/format');

Page({
  data: {
    user: null,
    pointsLedger: [],
    settings: null,
    dateText
  },
  async onShow() {
    const data = await api.getMemberData();
    this.setData({ user: data.user, pointsLedger: data.pointsLedger, settings: data.settings });
  },
  goOrders() {
    wx.navigateTo({ url: '/pages/orders/orders' });
  },
  goCoupons() {
    wx.navigateTo({ url: '/pages/coupons/coupons' });
  },
  goSupport() {
    wx.navigateTo({ url: '/pages/support/support' });
  },
  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/index/index' });
  },
  requestSubscribe() {
    const templates = Object.values(this.data.settings.subscribeTemplates).filter((item) => item.indexOf('待配置') === -1);
    if (templates.length === 0) {
      wx.showToast({ title: '请先配置订阅模板 ID', icon: 'none' });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: templates,
      complete: () => wx.showToast({ title: '订阅设置已更新', icon: 'none' })
    });
  },
  resetDemo() {
    api.resetDemo();
    this.onShow();
    wx.showToast({ title: '已恢复样例数据' });
  }
});
