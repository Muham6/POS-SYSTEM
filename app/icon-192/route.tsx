import { ImageResponse } from 'next/og'
import { getStoreIconData, iconMarkup } from '@/lib/icon-visual'

export async function GET() {
  const { letter, logoUrl } = await getStoreIconData()
  return new ImageResponse(iconMarkup(letter, logoUrl, 100), { width: 192, height: 192 })
}
