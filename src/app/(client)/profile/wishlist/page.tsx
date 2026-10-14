import React from 'react'
import Content from './Content'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Polubione produkty' }

const page = async () => {

    return (
    <>
        <Content />
    </>
  )
}

export default page