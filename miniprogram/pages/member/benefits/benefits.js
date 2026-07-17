const api = require('../../../common/api');
const { dateText } = require('../../../common/format');

Page({
  data: { benefits: [], loading: true },
  onShow() { this.loadBenefits(); },
  async loadBenefits() {
    this.setData({ loading: true });
    try {
      const benefits = await api.getMemberBenefits();
      this.setData({ benefits, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },
  async useBenefit(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await api.useBenefit(id);
      wx.showToast({ title: '使用成功！', icon: 'success' });
      this.loadBenefits();
    } catch (e) {
      wx.showToast({ title: e.message || '使用失败', icon: 'none' });
    }
  },
  dateText
});
