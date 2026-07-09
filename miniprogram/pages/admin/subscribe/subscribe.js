const api = require('../../../common/api');

Page({
  data: {
    tasks: [],
    form: {
      title: '老客复购提醒',
      scene: 'repurchaseReminder',
      audience: 'paid_users',
      scheduledAt: ''
    }
  },
  onShow() {
    this.refresh();
  },
  async refresh() {
    const data = await api.getAdminData();
    this.setData({ tasks: data.subscribeTasks });
  },
  input(event) {
    this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value });
  },
  async save() {
    await api.saveSubscribeTask(this.data.form);
    await this.refresh();
    wx.showToast({ title: '已保存草稿' });
  }
});
