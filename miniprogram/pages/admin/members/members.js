const api = require('../../../common/api');
const { dateText } = require('../../../common/format');

Page({
  data: { members: [], loading: true, keyword: '', detail: null },
  onShow() { this.loadMembers(); },
  async loadMembers() {
    this.setData({ loading: true });
    try {
      const members = await api.getMembers();
      this.setData({ members, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },
  input(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    if (!keyword) { this.setData({ detail: null }); return; }
    const found = this.data.members.filter(m => (m.nickname || '').includes(keyword) || (m.phone || '').includes(keyword));
    this.setData({ detail: found[0] || null });
  },
  async changeTier(e) {
    const { id, tier } = e.currentTarget.dataset;
    const tiers = await api.getTierConfig();
    const names = tiers.map(t => t.name);
    wx.showActionSheet({ itemList: names, success: async (res) => {
      await api.updateMemberTier({ memberId: id, tierId: tiers[res.tapIndex]._id });
      wx.showToast({ title: '已更新等级', icon: 'success' });
      this.loadMembers();
    }});
  },
  async givePoints() {
    const m = this.data.detail;
    if (!m) return;
    wx.showModal({
      title: '调整积分',
      editable: true,
      content: '输入调整数值（正数增加，负数扣除）：',
      success: async (res) => {
        if (res.confirm) {
          await api.adjustPoints({ userId: m.id, points: parseInt(res.content), note: '管理员调整' });
          wx.showToast({ title: '已调整', icon: 'success' });
          this.loadMembers();
        }
      }
    });
  },
  dateText
});
