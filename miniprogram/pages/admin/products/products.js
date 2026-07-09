const api = require('../../../common/api');

Page({
  data: { products: [] },
  onShow() {
    this.refresh();
  },
  async refresh() {
    const data = await api.getAdminData();
    this.setData({ products: data.products });
  },
  async toggleStatus(event) {
    const product = this.data.products.find((item) => item.id === event.currentTarget.dataset.id);
    await api.saveProduct({ ...product, status: product.status === 'on_sale' ? 'off_sale' : 'on_sale' });
    await this.refresh();
  },
  async stock(event) {
    const product = this.data.products.find((item) => item.id === event.currentTarget.dataset.id);
    const delta = Number(event.currentTarget.dataset.delta);
    const next = {
      ...product,
      skus: product.skus.map((sku, index) => index === 0 ? { ...sku, stock: Math.max(0, sku.stock + delta) } : sku)
    };
    await api.saveProduct(next);
    await this.refresh();
  }
});
