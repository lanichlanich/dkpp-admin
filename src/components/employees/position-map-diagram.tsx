import type { PositionMapPage } from "@/lib/position-map-model";

export function PositionMapDiagram({ page }: { page: PositionMapPage }) {
  return <svg viewBox={`0 0 ${page.width} ${page.height}`} className="block h-auto w-full bg-white" role="img" aria-label={page.title}>
    <title>{page.title}</title>
    {page.rects.map((rect, i) => <rect key={`r${i}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={`#${rect.color}`} />)}
    {page.tables.map((table, t) => {
      let y = table.y;
      return <g key={t}>{table.rows.map((row, r) => {
        let x = table.x; const rowY = y; y += table.heights[r];
        return <g key={r}>{row.map((value, c) => {
          const cellX = x; x += table.columns[c];
          const centered = table.centered || c > 0 || (r === 0 && table.header), bold = r === 0 && (table.header || table.centered);
          const size = !table.centered && c > 0 ? table.fontSize <= 6.5 ? 5.5 : table.fontSize - .5 : table.fontSize;
          const lines = value.split("\n"), lineHeight = size + 1.2;
          return <g key={c}>
            <rect x={cellX} y={rowY} width={table.columns[c]} height={table.heights[r]} fill={r === 0 && table.fill ? `#${table.fill}` : "transparent"} stroke={table.borders ? "#000" : "none"} strokeWidth={.5} />
            <text x={centered ? cellX + table.columns[c] / 2 : cellX + 1} fill="#000" fontFamily="Calibri, Arial, sans-serif" fontSize={size} fontWeight={bold ? 700 : 400} textAnchor={centered ? "middle" : "start"} dominantBaseline="central">
              {lines.map((line, n) => <tspan key={n} x={centered ? cellX + table.columns[c] / 2 : cellX + 1} y={rowY + table.heights[r] / 2 + (n - (lines.length - 1) / 2) * lineHeight}>{line}</tspan>)}
            </text>
          </g>;
        })}</g>;
      })}</g>;
    })}
    {page.labels.map((label, i) => <text key={`l${i}`} x={label.x + label.width / 2} y={label.y + label.size} fill="#000" textAnchor="middle" fontFamily="Calibri, Arial, sans-serif" fontSize={label.size} fontWeight={label.bold ? 700 : 400}>{label.text}</text>)}
  </svg>;
}
