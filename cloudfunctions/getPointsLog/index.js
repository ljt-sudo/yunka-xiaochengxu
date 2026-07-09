// 云函数：查询积分流水
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { page = 1, pageSize = 20 } = event

  const res = await db.collection('pointsLog')
    .where({ _openid: OPENID })
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  const total = await db.collection('pointsLog')
    .where({ _openid: OPENID })
    .count()

  return {
    code: 0,
    data: {
      list: res.data,
      total: total.total,
      page: page,
      hasMore: page * pageSize < total.total,
    }
  }
}
