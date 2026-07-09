const api = require('../../common/api');
const { dateText } = require('../../common/format');

Page({
  data: {
    list: [],
    loading: true,
    hasMore: true,
    page: 0,
    pageSize: 20
  },

  onLoad() {
    this.loadMore();
  },

  async loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ loading: true });
    try {
      const offset = this.data.page * this.data.pageSize;
      const items = await api.getPointsHistory(this.data.pageSize, offset);
      this.setData({
        list: [...this.data.list, ...items],
        page: this.data.page + 1,
        hasMore: items.length >= this.data.pageSize,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onReachBottom() {
    this.loadMore();
  },

  dateText: dateText
});
