import { getOrderDetail } from '@/actions/orders'
import ProfileMenu from '@/components/ProfileMenu'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { format } from 'date-fns'
import React from 'react'
import { pl } from 'date-fns/locale'
import PriceFormatter from '@/components/PriceFormatter'
import Link from 'next/link'

const Content = ({orders}:{orders:Awaited<ReturnType<typeof getOrderDetail>>[]}) => {
  //console.log(orders)
  const convertStatus = {
    'pending': 'Oczekujące',
    'awaiting_payment': 'Oczekujące na płatność',
    'paid': 'Opłacone',
    'processing': 'W trakcie realizacji',
    'shipped': 'Wysłane',
    'delivered': 'Dostarczone',
    'cancelled': 'Anulowane',
    'refunded': 'Zwrócone',
  }
  return (
    <div className="flex max-3md:flex-col w-full 3md:pt-10 pt-3 relative">        
        <ProfileMenu selected={1}/>        
        <div className='w-full lg:w-[calc(100%-300px)] 3md:w-[calc(100%-250px)] flex flex-col space-y-16 mt-2 flex-wrap xl:ml-0 3md:ml-3 '>
            {orders.map((order,_)=>(
              <div key={_} className="flex flex-col w-full">
                {/* Grid karty zamówienia — obszary title/image/details/actions/buttons
                    rozmieszczone w globals.css (.profile-order-card): mobile i ≥768px */}
                <div className="profile-order-card">
                  <h1 className="profile-order-title text-[16px] text-[#6C6C6C] flex">Zamówienie: <span className="text-black max-w-[200px] ml-1">#{order?.order.id.slice(0, 8).toUpperCase()}</span></h1>
                  <div className="profile-order-image flex relative xl:w-[200px] md:w-[170px] w-[150px] xl:h-[200px] md:h-[170px] h-[150px] brightness-93">
                        {order?.items[0]?.imageUrl && (
                          <Image
                            src={order.items[0].imageUrl}
                            alt={order.items[0].name ?? 'Order item'}
                            width={200}
                            height={200}
                            className="object-cover border-1 border-[#6C6C6C] rounded-[20px]"
                          />
                        )}
                        {order?.items[1]?.imageUrl && (
                          <Image
                            src={order.items[1].imageUrl}
                            alt={order.items[1].name ?? 'Order item'}
                            width={200}
                            height={200}
                            className="object-cover xl:w-[180px] md:w-[150px] w-[130px] xl:h-[180px] md:h-[150px] h-[130px] absolute top-9 left-9 border-1 border-[#6C6C6C] rounded-[20px]"
                          />
                        )}
                        
                      </div>
                  <div className={`profile-order-details flex flex-col space-y-1 2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] text-black ${
                    order?.items.length && order?.items.length > 1 ? 'ml-10' : 'ml-5'
                  }`}>
                        <p>Ilość produktów: {order?.items?.length}</p>
                        {order?.order?.totalCents && 
                          <p>Suma: <PriceFormatter
                            amount={(order?.order?.totalCents) / 100}
                            className="2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] font-normal text-black"
                          /></p>
                        }
                        
                        {order?.order?.createdAt && 
                          <p>Złożone {format(new Date(order?.order?.createdAt), 'd MMMM yyyy, HH:mm', { locale: pl })}</p>
                        }
                      </div>
                  <div className="profile-order-actions flex flex-col md:items-end items-start max-md:mb-2">
                        <h1 className="2xl:text-[18px] text-[clamp(14px,1.8vw,16px)] max-xl:flex max-xl:flex-col max-md:flex-row max-xl:items-end text-black max-md:space-x-3" ><span>Stan zamówienia: </span><span className="font-medium">{order?.order?.status != undefined && convertStatus[order?.order?.status]}</span></h1>
                        {order?.order?.updatedAt && (
                          <p className="2xl:text-[14px] text-[clamp(11px,1.8vw,13px)] text-black mt-1 max-xl:flex max-xl:flex-col max-md:flex-row max-xl:items-end max-md:space-x-3"><span>ost. aktualizacja: </span><span>{format(new Date(order?.order?.updatedAt), 'd MMMM yyyy, HH:mm', { locale: pl })}</span></p>
                        )}
                    </div>
                  <div className={`profile-order-buttons flex space-x-4 ${
                    order?.items.length && order?.items.length > 1 ? 'max-md:ml-10' : 'max-md:ml-5'
                  }`}>
                        {order?.order.id && (
                          <Button asChild
                              className="w-fit rounded-full font-bold bg-[#EDEDED] text-fancy-black 2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] md:py-6 py-4 md:px-8 px-6 hover:bg-[#EDEDED]/40 hover:text-fancy-black transition-colors cursor-pointer">
                              <Link href={`/profile/orders/${order.order.id}`}>Szczegóły</Link>
                          </Button>
                        )}
                        {order?.shipment?.trackingNumber ? (
                          <Button asChild
                              className="w-fit rounded-full font-bold bg-fancy-black text-white 2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] py-6 px-8 hover:bg-fancy-black/90 transition-colors cursor-pointer">
                              <Link href={`/profile/orders/${order.order.id}`}>Śledź przesyłkę</Link>
                          </Button>
                        ) : null}
                    </div>
                </div>
                <div className="flex w-full mt-8 relative ">
                  <div id="order-items"  className="flex overflow-x-auto w-full pb-2">
                  {order?.items.map((item, i) => (
                    <div key={i} className='flex items-center '>
                      <div  className='flex flex-col'>
                        <p className='2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] text-[#6C6C6C]'>{item.brand}</p>
                        <p className='2xl:text-[18px] text-[clamp(14px,1.8vw,16px)] text-black text-nowrap'>{item.name}</p>
                        <p className='2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] text-[#6C6C6C]'>{item.variantLabel}</p>
                      </div>
                      { i != order.items.length -1 && 
                      <hr className='h-[50px] w-[1px] bg-black mx-6'/>
                      }
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            ))}
        </div>
    </div>
  )
}

export default Content