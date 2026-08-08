'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type DayData = { sale_day: string; total_revenue: number }

export default function SalesTrendChart({ data }: { data: DayData[] }) {
  const chartData = [...data]
    .sort((a, b) => a.sale_day.localeCompare(b.sale_day))
    .map((d) => ({
      day: new Date(d.sale_day).toLocaleDateString('en-NG', { weekday: 'short' }),
      revenue: Number(d.total_revenue),
    }))

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#a3a3a3' }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
          formatter={(value) => [formatNaira(Number(value ?? 0)), 'Revenue']}
          contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e5e5' }}
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