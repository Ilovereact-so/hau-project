import InPostLogo from './public/InPost_logotype_2024_white_bg.svg';
import DPDLogo from './public/DPD_logo_redgrad_rgb.png';
import { createElement, type ReactNode } from 'react';

type ShippingAsset = {
  logo: { src: string };
  displayName: ReactNode;
};

export const SHIPPING_ASSETS: Record<string, ShippingAsset> = {
  'inpost': {
    logo: InPostLogo,
    displayName: createElement(
      'p',
      { className: 'text-[16px] text-black' },
      createElement('span', { className: 'text-[#FFCC05]' }, 'InPost'),
      ' Kurier',
    ),
  },
  'dpd': {
    logo: DPDLogo,
    displayName: createElement(
      'p',
      { className: 'text-[16px] text-black' },
      createElement('span', { className: 'text-[#DC0032]' }, 'DPD'),
      ' Kurier',
    ),
  },
  'inpost-automat': {
    logo: InPostLogo,
    displayName: createElement(
      'p',
      { className: 'text-[16px] text-black' },
      createElement('span', { className: 'text-[#FFCC05]' }, 'InPost'),
      ' Automat',
    ),
  },
  'dpd-automat': {
    logo: DPDLogo,
    displayName: createElement(
      'p',
      { className: 'text-[16px] text-black' },
      createElement('span', { className: 'text-[#DC0032]' }, 'DPD'),
      ' Automat',
    ),
  },
};