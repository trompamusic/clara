export interface NoteGeometry {
  id: string;
  staffId: string | null;
  layerId: string | null;
  x: number;
  y: number;
  x2: number;
  y2: number;
}
export interface PageGeometry {
  notes: Record<string, NoteGeometry>;
  barlines: Array<{ x: number }>;
  visualOrder: string[];
}

// The only layout-reading boundary used by the visualizations.
export function measureScorePage(svg: SVGSVGElement): PageGeometry {
  const offset = svg.parentElement!.getBoundingClientRect();
  const bounds = (element: SVGGraphicsElement) => {
    const box = element.getBBox();
    const matrix = element.getScreenCTM();
    if (!matrix) return null;
    const points = [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x, box.y + box.height],
      [box.x + box.width, box.y + box.height],
    ].map(([x, y]) => ({
      x: matrix.a * x + matrix.c * y + matrix.e - offset.left,
      y: matrix.b * x + matrix.d * y + matrix.f - offset.top,
    }));
    if (!points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
      return null;
    return {
      x: Math.min(...points.map((p) => p.x)),
      y: Math.min(...points.map((p) => p.y)),
      x2: Math.max(...points.map((p) => p.x)),
      y2: Math.max(...points.map((p) => p.y)),
    };
  };
  const notes: PageGeometry["notes"] = {};
  svg.querySelectorAll<SVGGraphicsElement>(".note").forEach((element) => {
    const rect = bounds(element);
    if (rect && element.id)
      notes[element.id] = {
        ...rect,
        id: element.id,
        staffId: element.closest(".staff")?.id || null,
        layerId: element.closest(".layer")?.id || null,
      };
  });
  const barlines: PageGeometry["barlines"] = [];
  svg
    // Barline groups do not need an ID to be measured.
    .querySelectorAll<SVGGraphicsElement>(".barLine")
    .forEach((element) => {
      const rect = bounds(element);
      if (rect) barlines.push({ x: rect.x });
    });
  return {
    notes,
    barlines,
    visualOrder: Object.keys(notes).sort(
      (a, b) => notes[a].x - notes[b].x || notes[a].y - notes[b].y,
    ),
  };
}
