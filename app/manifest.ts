import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const supabase = await createClient()
  const { data } = await supabase.from('store_settings').select('store_name').eq('id', 1).single()
  const name = data?.store_name || 'POS System'

  return {
    name,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    description: `${name} — point of sale`,
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#10b981',
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
