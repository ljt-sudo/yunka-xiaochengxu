const api = require('../../../common/api');
Page({
  data: { settings: null, loading: true },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true });
    const settings = await api.getSettings();
    this.setData({ settings, loading: false });
  },
  input(e) {
    const { field } = e.currentTarget.dataset;
    const s = this.data.settings;
    const parts = field.split('.');
    if (parts.length === 2) s[parts[0]][parts[1]] = e.detail.value;
    this.setData({ settings: s });
  },
  async save() {
    await api.saveSettings({ settings: this.data.settings });
    wx.showToast({ title: '已保存', icon: 'success' });
  }
});
