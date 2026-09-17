import { PortableText } from 'next-sanity'
import React from 'react'
import { TypedObject } from 'sanity'

const TopInfoBar = () => {
    const content: TypedObject[] = [
        {
            _type: 'block',
            _key: '1',
            style: 'normal',
            children: [
                {
                    _type: 'span',
                    _key: '0',
                    text: 'Otrzymaj 10% rabatu ',
                    marks: []
                },
                {
                    _type: 'span',
                    _key: '1',
                    text: 'zapisując się do newslettera!',
                    marks: ['strong']
                }
            ],
            markDefs: []
        }
    ]
    return (
        <div className='flex w-full justify-center bg-[#D1EAE6] px-3 text-center text-black py-2 text-[clamp(13px,1.5vw,16px)] font-poppins'>
            <PortableText value={content}/>
        </div>
    )
}

export default TopInfoBar