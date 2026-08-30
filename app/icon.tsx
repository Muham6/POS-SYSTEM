import { ImageResponse } from 'next/og'
import { getStoreIconData, iconMarkup } from '@/lib/icon-visual'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default async function Icon() {
  const { letter, logoUrl } = await getStoreIconData()
  return new ImageResponse(iconMarkup(letter, logoUrl, 18), size)
}
