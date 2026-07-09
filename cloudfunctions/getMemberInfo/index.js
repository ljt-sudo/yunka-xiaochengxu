// 云函数：获取/创建会员信息
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  // 查会员
  let res = await db.collection('members').where({ _openid: OPENID }).get()

  if (res.data.length === 0) {
    // 新用户，自动注册会员
    const memberData = {
      _openid: OPENID,
      name: event.nickName || '微信用户',
      avatar: event.avatarUrl || '',
      phone: '',
      level: '普通会员',
      points: 0,
      balance: 0,
      totalConsumption: 0,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    }
    await db.collection('members').add({ data: memberData })
    return { code: 0, data: memberData }
  }

  return { code: 0, data: res.data[0] }
}
