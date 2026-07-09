const api = require('../../../common/api');

Page({
  data: { user: null },
  async onShow() {
    const data = await api.getAdminData();
    this.setData({ user: data.user });
  },
  go(event) {
    wx.navigateTo({ url: event.currentTarget.dataset.url });
  }
});
