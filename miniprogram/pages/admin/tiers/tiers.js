const api = require('../../../common/api');
Page({
  data: { tiers: [], loading: true, editing: null, editIndex: -1 },
  onShow() { this.loadTiers(); },
  async loadTiers() {
    this.setData({ loading: true });
    const tiers = await api.getTierConfig();
    tiers.forEach(t => {
      if (t.conditions && t.conditions.entryRequirements) {
        t.spendReqText = Math.round(t.conditions.entryRequirements.totalSpendCents / 100);
        t.cardReqText = Math.round(t.conditions.entryRequirements.orPurchaseCardCents / 100);
      }
    });
    this.setData({ tiers, loading: false });
  },
  editTier(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ editing: JSON.parse(JSON.stringify(this.data.tiers[idx])), editIndex: idx });
  },
  cancelEdit() { this.setData({ editing: null, editIndex: -1 }); },
  inputField(e) {
    const { field } = e.currentTarget.dataset;
    const editing = this.data.editing;
    editing[field] = e.detail.value;
    this.setData({ editing });
  },
  inputBenefit(e) {
    const { idx, field } = e.currentTarget.dataset;
    const editing = this.data.editing;
    editing.benefits[idx][field] = e.detail.value;
    this.setData({ editing });
  },
  async saveTier() {
    await api.updateTierConfig({ tier: this.data.editing });
    wx.showToast({ title: '已保存', icon: 'success' });
    this.cancelEdit();
    this.loadTiers();
  }
});
