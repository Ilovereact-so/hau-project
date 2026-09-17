import React from 'react'
import Content from './Content'
import { getMyOrders, getOrderDetail } from '@/actions/orders'
import { requireUser } from '@/lib/requireUser'

const page = async () => {
    await requireUser('/profile/orders')
    const myOrders = await getMyOrders()

    const myOrderDetail = await Promise.all(
      myOrders.map(async (order) => {
        return getOrderDetail(order.id)
      })
    )

    
    return (
    <>
        <Content orders={myOrderDetail} />
    </>
  )
}

export default page