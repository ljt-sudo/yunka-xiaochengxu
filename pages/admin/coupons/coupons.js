const api = require('../../../common/api');

Page({
  data: {
    coupons: [],
    form: {
      title: '老客复购券',
      amountOffYuan: 15,
      minSpendYuan: 99
    }
  },
  onShow() {
    this.refresh();
  },
  async refresh() {
    const data = await api.getAdminData();
    this.setData({ coupons: data.coupons });
  },
  input(event) {
    this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value });
  },
  async save() {
    const form = this.data.form;
    await api.saveCoupon({
      id: `coupon_${Date.now()}`,
      title: form.title,
      type: 'amount_off',
      amountOffCents: Math.round(Number(form.amountOffYuan || 0) * 100),
      minSpendCents: Math.round(Number(form.minSpendYuan || 0) * 100),
      expiresAt: '2099-01-01T00:00:00.000Z',
      status: 'active'
    });
    await this.refresh();
    wx.showToast({ title: '已创建' });
  }
});
