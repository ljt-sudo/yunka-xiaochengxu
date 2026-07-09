App({
  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({ traceUser: true });
    }
  },
  globalData: {
    brandName: '云咖铺子'
  }
});
