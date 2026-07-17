const api = require('../../../common/api');
Page({
  data: { members: [], benefits: [], loading: true, showForm: false, totalCount: 0, activeCount: 0, usedCount: 0 },
  onShow() { this.loadData(); },
  async loadData() {
    this.setData({ loading: true });
    const [members, tiers] = await Promise.all([api.getMembers(), api.getTierConfig()]);
    const benefits = this.data.benefits || [];
    this.setData({
      members, tiers, loading: false,
      totalCount: benefits.length,
      activeCount: benefits.filter(b => b.status === 'active').length,
      usedCount: benefits.filter(b => b.status === 'used').length
    });
  },
  showForm() {
    wx.showModal({
      title: '发放权益',
      content: '权益描述（如：免费饮品券）',
      editable: true,
      success: async (res) => {
        if (!res.confirm) return;
        const desc = res.content;
        wx.showActionSheet({
          itemList: (this.data.tiers || []).map(t => `发放给「${t.name}」会员`),
          success: async (r) => {
            const tierId = this.data.tiers[r.tapIndex]._id;
            await api.createBenefit({ desc, tierSource: tierId });
            wx.showToast({ title: '已批量发放', icon: 'success' });
            this.loadData();
          }
        });
      }
    });
  }
});
