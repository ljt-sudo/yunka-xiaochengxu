const api = require('../../../common/api');

Page({
  data: {
    user: null,
    pointsLedger: [],
    points: 100,
    note: '客服人工调整'
  },
  onShow() {
    this.refresh();
  },
  async refresh() {
    const data = await api.getAdminData();
    this.setData({ user: data.user, pointsLedger: data.pointsLedger });
  },
  input(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value });
  },
  async adjust() {
    await api.adjustPoints({
      userId: this.data.user.id,
      points: Number(this.data.points || 0),
      note: this.data.note
    });
    await this.refresh();
    wx.showToast({ title: '已调整' });
  }
});
