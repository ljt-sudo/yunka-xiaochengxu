const api = require('../../common/api');

Page({
  data: { settings: null, orderId: '' },
  async onLoad(options) {
    this.setData({ settings: await api.getSettings(), orderId: options.orderId || '' });
  },
  copyWechat() {
    wx.setClipboardData({ data: this.data.settings.support.wechat });
  }
});
