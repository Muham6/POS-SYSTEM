import { ImageResponse } from 'next/og'
import { getStoreIconData, iconMarkup } from '@/lib/icon-visual'

export async function GET() {
  const { letter, logoUrl } = await getStoreIconData()
  return new ImageResponse(iconMarkup(letter, logoUrl, 260), { width: 512, height: 512 })
}
