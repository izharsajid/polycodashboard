/**
 * A summary figure in a panel. Income tiles are green so money coming in stands
 * out; the figure the panel is about is the one strong, dark tile.
 */
export default function Tile({
  label,
  value,
  tone = 'plain',
}: {
  label: string
  value: string
  tone?: 'plain' | 'income' | 'strong'
}) {
  const look =
    tone === 'income' ? 'bg-income-wash text-income' : tone === 'strong' ? 'bg-press text-sheet' : 'bg-mist text-press'
  return (
    <div className={`rounded-card px-3 py-2.5 ${look}`}>
      <p className="text-small opacity-80">{label} (US$)</p>
      <p className="num text-title font-bold">{value}</p>
    </div>
  )
}
