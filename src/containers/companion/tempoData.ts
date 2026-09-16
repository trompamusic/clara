import {
  Instant,
  pageData,
  scoreMetadata,
  averageQstamp,
  ids,
  time,
} from "./featureVisData";
type Range = {
  min: number;
  max: number;
  displayMin: number;
  displayMax: number;
};
type Point = {
  x: number;
  y: number;
  qstamp: string;
  instants: Instant[];
  gapFromPrevValid: boolean;
};
// Standard metronome markings (BPM values)
const STANDARD_METRONOME_MARKINGS = [
  40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 63, 66, 69, 72, 76, 80, 84, 88,
  92, 96, 100, 104, 108, 112, 116, 120, 126, 132, 138, 144, 152, 160, 168, 176,
  184, 200, 208,
];

const fallbackRange = { min: 40, max: 200, displayMin: 40, displayMax: 200 };
// Calculate global min/max tempo from entire performance (all timelines)
export function tempoRange(
  instantsByNoteId: Record<string, Record<string, Instant | Instant[]>>,
  timemapByNoteId: ReturnType<typeof scoreMetadata>["timemapByNoteId"],
): Range {
  if (
    !instantsByNoteId ||
    !timemapByNoteId ||
    Object.keys(instantsByNoteId).length === 0
  ) {
    return fallbackRange;
  }

  const allTempos: number[] = [];

  // Process all timelines
  Object.keys(instantsByNoteId).forEach((tl) => {
    if (!instantsByNoteId[tl]) {
      return;
    }

    // Get all instants for this timeline
    const seen = new Set();
    const allInstants = Object.values(instantsByNoteId[tl])
      .flat()
      .filter((inst) => {
        if (!inst || seen.has(inst["@id"] || inst)) return false;
        seen.add(inst["@id"] || inst);
        return Number.isFinite(time(inst)) && time(inst) >= 0;
      })
      .sort((a, b) => time(a) - time(b));

    const getQstampForInstant = (inst: Instant) =>
      averageQstamp(ids(inst), timemapByNoteId);

    // Calculate tempo (iii) between consecutive instants
    for (let i = 1; i < allInstants.length; i++) {
      const prevInst = allInstants[i - 1];
      const thisInst = allInstants[i];

      const prevT = parseFloat(
        prevInst["http://purl.org/NET/c4dm/timeline.owl#at"].replace(
          /[PS]/g,
          "",
        ),
      );
      const thisT = parseFloat(
        thisInst["http://purl.org/NET/c4dm/timeline.owl#at"].replace(
          /[PS]/g,
          "",
        ),
      );

      const deltaT = thisT - prevT;
      if (deltaT <= 0) continue; // Skip invalid intervals

      const prevQ = getQstampForInstant(prevInst);
      const thisQ = getQstampForInstant(thisInst);

      if (prevQ === null || thisQ === null) continue;

      const deltaQ = thisQ - prevQ;
      if (deltaQ <= 0) continue; // Skip invalid intervals

      // Calculate inter-instant-interval (iii)
      const iii = deltaQ / deltaT;
      const bpm = iii * 60; // Convert to BPM

      if (isFinite(bpm) && bpm > 0 && bpm < 1000) {
        // Reasonable BPM range
        allTempos.push(bpm);
      }
    }
  });

  if (allTempos.length === 0) {
    // Fallback to default range
    return fallbackRange;
  }

  // Sort tempos and find min/max
  allTempos.sort((a, b) => a - b);
  const minTempo = allTempos[0];
  const maxTempo = allTempos[allTempos.length - 1];

  // Use 10%-90% range
  const percentile10Index = Math.floor(allTempos.length * 0.1);
  const percentile90Index = Math.min(
    Math.floor(allTempos.length * 0.9),
    allTempos.length - 1,
  );
  const percentile10 = allTempos[percentile10Index];
  const percentile90 = allTempos[percentile90Index];

  const displayMin = percentile10;
  const displayMax = percentile90;

  return { min: minTempo, max: maxTempo, displayMin, displayMax };
}

// Select appropriate metronome markings within the display range
// Ensures minimum pixel spacing between labels to avoid overlap
export function selectMetronomeMarkings(
  minBpm: number,
  maxBpm: number,
  height: number,
) {
  const minPixelSpacing = 12; // Minimum pixels between labels

  // Helper to convert BPM to y position for this range
  const bpmToYLocal = (bpm: number) => {
    const range = maxBpm - minBpm;
    if (range <= 0) return height / 2;
    const normalized = (bpm - minBpm) / range;
    return Math.max(0, Math.min(1, normalized)) * height;
  };

  // Filter markings within range
  const inRange = STANDARD_METRONOME_MARKINGS.filter(
    (marking) => marking >= minBpm * 0.9 && marking <= maxBpm * 1.1,
  );

  if (inRange.length === 0) {
    // If no standard markings in range, use min and max rounded to nearest 10
    return [Math.round(minBpm / 10) * 10, Math.round(maxBpm / 10) * 10];
  }

  // Select markings ensuring minimum pixel spacing
  const selected = [];
  let lastY = -Infinity;

  for (const marking of inRange) {
    const y = bpmToYLocal(marking);
    if (y - lastY >= minPixelSpacing) {
      selected.push(marking);
      lastY = y;
    }
  }

  // Always try to include the last marking if there's room
  const lastMarking = inRange[inRange.length - 1];
  if (selected[selected.length - 1] !== lastMarking) {
    const lastSelectedY = bpmToYLocal(selected[selected.length - 1]);
    const lastMarkingY = bpmToYLocal(lastMarking);
    if (lastMarkingY - lastSelectedY >= minPixelSpacing) {
      selected.push(lastMarking);
    }
  }

  return selected;
}

export function bpmToY(bpm: number, range: Range, height: number) {
  const span = range.displayMax - range.displayMin;
  return span <= 0 ? height / 2 : ((bpm - range.displayMin) / span) * height;
}

export function tempoPoints(
  page: ReturnType<typeof pageData>,
  range: Range,
  height: number,
) {
  const pointsPerTimeline: Record<string, Point[]> = {};
  page.timelinesToVis.forEach((tl) => {
    let scoretimeArray = Object.keys(page.instantsByScoretime[tl]).sort(
      (a, b) => {
        return parseFloat(a) - parseFloat(b);
      },
    );
    // for each instant on this page ...
    const pointsForThisTl: Point[] = [];
    let hadInvalidGap = false;
    scoretimeArray.forEach((qstamp, ix) => {
      // xpos should be average x position for note elements at this qstamp
      const notes = page.notesForGroup[tl][qstamp];
      if (!notes.length) {
        hadInvalidGap = true;
        return;
      }
      const avgXPos =
        notes.reduce((sum, note) => sum + (note.x + note.x2) / 2, 0) /
        notes.length;

      // calculate y position (default to 0 on first instant)
      let yPos = 0;
      if (ix > 0) {
        // calculate change in avg performance time of instants at previous and current qstamp
        // TODO optimise (cache)
        const theseTimestamps = page.instantsByScoretime[tl][qstamp].map(
          (inst) => {
            return parseFloat(
              inst["http://purl.org/NET/c4dm/timeline.owl#at"].replace(
                /[PS]/g,
                "",
              ),
            );
          },
        );
        const thisT =
          theseTimestamps.reduce((sumT, t) => sumT + t) /
          theseTimestamps.length;

        const prevTimestamps = page.instantsByScoretime[tl][
          scoretimeArray[ix - 1]
        ].map((inst) => {
          return parseFloat(
            inst["http://purl.org/NET/c4dm/timeline.owl#at"].replace(
              /[PS]/g,
              "",
            ),
          );
        });
        const prevT =
          prevTimestamps.reduce((sumT, t) => sumT + t) / prevTimestamps.length;

        const deltaT = thisT - prevT;

        // calculate change in scoretime (qstamp) between this and the current one
        const deltaQ = parseFloat(qstamp) - parseFloat(scoretimeArray[ix - 1]);

        // calculate inter-instant-interval (change in score time per change in performed time)
        const iii = deltaQ / deltaT;
        // Convert iii to BPM and then to y position using dynamic scale
        const bpm = iii * 60;
        if (!isFinite(bpm) || bpm <= 0) {
          hadInvalidGap = true;
          return;
        }
        yPos = bpmToY(bpm, range, height);
      }
      pointsForThisTl.push({
        x: avgXPos,
        y: yPos,
        qstamp: qstamp,
        instants: page.instantsByScoretime[tl][qstamp],
        gapFromPrevValid: hadInvalidGap,
      });
      hadInvalidGap = false;
    });
    pointsPerTimeline[tl] = pointsForThisTl;
  });
  return pointsPerTimeline;
}
