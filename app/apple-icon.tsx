import { ImageResponse } from 'next/og'
import { getStoreIconData, iconMarkup } from '@/lib/icon-visual'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default async function AppleIcon() {
  const { letter, logoUrl } = await getStoreIconData()
  return new ImageResponse(iconMarkup(letter, logoUrl, 100), size)
}
