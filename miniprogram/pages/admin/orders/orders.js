const api = require('../../../common/api');

Page({
  data: {
    orders: [],
    expressCompany: '顺丰速运',
    expressNo: '',
    sourceList: [],
    filterSourceText: '📋 全部来源',
    filterSource: ''
  },
  onShow() {
    this.refresh();
  },
  async refresh() {
    const orders = await api.listOrders();
    const sources = [...new Set(orders.map(o => o.source).filter(s => s))];
    this.setData({ 
      orders, 
      sourceList: ['全部来源', ...sources],
      filterSourceText: this.data.filterSource || '📋 全部来源'
    });
  },
  filterSource(e) {
    const idx = e.detail.value;
    const list = this.data.sourceList;
    const selected = list[idx];
    if (selected === '全部来源') {
      this.setData({ filterSource: '', filterSourceText: '📋 全部来源' });
      this.refresh();
    } else {
      this.setData({ filterSource: selected, filterSourceText: selected });
    }
  },
  input(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value });
  },
  async ship(event) {
    await api.shipOrder({
      orderId: event.currentTarget.dataset.id,
      expressCompany: this.data.expressCompany,
      expressNo: this.data.expressNo || `SF${Date.now()}`
    });
    await this.refresh();
    wx.showToast({ title: '已发货' });
  }
});
