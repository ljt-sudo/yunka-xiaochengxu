const api = require('../../../common/api');

Page({
  data: { 
    user: null,
    stats: null,
    loading: true
  },
  async onShow() {
    this.setData({ loading: true });
    try {
      const data = await api.getAdminData();
      this.setData({ user: data.user, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },
  go(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.url });
  }
});
