// SVG fill patterns so good/bad/open never rely on colour alone.
// Ids are prefixed per chart (useId) so several charts can share a page.

export function Patterns({ id }: { id: string }) {
  return (
    <defs>
      {/* Missed / over the limit: diagonal hatch. */}
      <pattern id={`${id}-bad`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" className="pat-bad-bg" />
        <line x1="0" y1="0" x2="0" y2="5" className="pat-bad-line" />
      </pattern>
      {/* Open period, not scored yet: wide stripes the other way. */}
      <pattern id={`${id}-open`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <line x1="0" y1="0" x2="0" y2="6" className="pat-open-line" />
      </pattern>
      {/* "Over the limit" zone behind limit-habit bars. */}
      <pattern id={`${id}-zone`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" className="pat-zone-line" />
      </pattern>
    </defs>
  );
}
