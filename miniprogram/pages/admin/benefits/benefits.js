const api = require('../../../common/api');
const { dateText } = require('../../../common/format');
Page({
  data: { members: [], benefits: [], loading: true, showForm: false },
  onShow() { this.loadData(); },
  async loadData() {
    this.setData({ loading: true });
    const [members, tiers] = await Promise.all([api.getMembers(), api.getTierConfig()]);
    this.setData({ members, tiers, loading: false });
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
  },
  dateText
});
