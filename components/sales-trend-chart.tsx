'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type DayData = { sale_day: string; total_revenue: number }

// Recharts takes plain color props, not Tailwind classes, so it needs to know
// the OS-level color scheme directly to stay in sync with the rest of the app.
function useIsDark() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const id = requestAnimationFrame(() => setIsDark(query.matches))
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches)
    query.addEventListener('change', handler)
    return () => {
      cancelAnimationFrame(id)
      query.removeEventListener('change', handler)
    }
  }, [])

  return isDark
}

export default function SalesTrendChart({ data }: { data: DayData[] }) {
  const isDark = useIsDark()

  const chartData = [...data]
    .sort((a, b) => a.sale_day.localeCompare(b.sale_day))
    .map((d) => ({
      day: new Date(d.sale_day).toLocaleDateString('en-NG', { weekday: 'short' }),
      revenue: Number(d.total_revenue),
    }))

  const gridColor = isDark ? '#262626' : '#f0f0f0'
  const tickColor = isDark ? '#737373' : '#a3a3a3'
  const tooltipBg = isDark ? '#171717' : '#ffffff'
  const tooltipBorder = isDark ? '#404040' : '#e5e5e5'
  const tooltipText = isDark ? '#f5f5f5' : '#171717'

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: tickColor }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: tickColor }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            formatter={(value) => [formatNaira(Number(value ?? 0)), 'Revenue']}
            contentStyle={{
              fontSize: 13,
              borderRadius: 8,
              border: `1px solid ${tooltipBorder}`,
              backgroundColor: tooltipBg,
              color: tooltipText,
            }}
            labelStyle={{ color: tooltipText }}
          />
          <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function formatNaira(value: number) {
  return 'N' + value.toLocaleString()
}