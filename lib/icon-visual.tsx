import { createClient } from '@/lib/supabase/server'

export async function getStoreIconData() {
  const supabase = await createClient()
  const { data } = await supabase.from('store_settings').select('store_name, logo_url').eq('id', 1).single()
  return {
    letter: (data?.store_name || 'P').trim().charAt(0).toUpperCase() || 'P',
    logoUrl: data?.logo_url || null,
  }
}

export function iconMarkup(letter: string, logoUrl: string | null, fontSize: number) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} width="100%" height="100%" style={{ objectFit: 'cover' }} alt="" />
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#10b981',
        color: 'white',
        fontFamily: 'sans-serif',
        fontWeight: 700,
        fontSize,
      }}
    >
      {letter}
    </div>
  )
}
