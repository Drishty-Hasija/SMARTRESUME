import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

/** Minimal horizontal bar chart: number of detected skills per category. */
export default function SkillChart({ byCategory, height }) {
  const data = Object.entries(byCategory || {}).map(([name, v]) => ({ name, count: Array.isArray(v) ? v.length : v }))
  if (data.length < 2) return null
  const h = height || 36 * data.length + 24
  return (
    <div style={{ height: h }} role="img" aria-label={`Skills per category: ${data.map((d) => `${d.name} ${d.count}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#E4E4E7" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#71717A' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#3F3F46' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#F4F4F2' }} contentStyle={{ border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 12, boxShadow: 'none' }} formatter={(v) => [`${v} skills`, '']} separator="" />
          <Bar dataKey="count" fill="#171717" radius={[0, 2, 2, 0]} barSize={14} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
