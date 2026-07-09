const api = require('../../common/api');
const { money } = require('../../common/format');

Page({
  data: {
    products: [],
    filteredProducts: [],
    activeCategory: 'all',
    categories: [
      { id: 'all', name: '推荐' },
      { id: '即溶茶咖', name: '茶咖' },
      { id: '挂耳咖啡', name: '挂耳' }
    ],
    money
  },
  async onShow() {
    try {
      const products = await api.listProducts();
      this.setData({
        products,
        filteredProducts: this.filterProducts(products, this.data.activeCategory)
      });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },
  filterProducts(products, category) {
    if (category === 'all') return products;
    return products.filter((product) => product.category === category);
  },
  switchCategory(event) {
    const activeCategory = event.currentTarget.dataset.id;
    this.setData({
      activeCategory,
      filteredProducts: this.filterProducts(this.data.products, activeCategory)
    });
  },
  goProduct(event) {
    wx.navigateTo({ url: `/pages/product/product?id=${event.currentTarget.dataset.id}` });
  }
});
