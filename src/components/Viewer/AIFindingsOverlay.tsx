import { useState } from 'react';
import type { FindingBox } from '@/types/radiology';
import { cn } from '@/lib/utils';

interface AIFindingsOverlayProps {
  findings: FindingBox[];
  className?: string;
}

/**
 * SVG overlay that renders MedGemma bounding boxes on top of the DICOM viewport.
 *
 * Coordinate system: MedGemma returns box_2d = [y_min, x_min, y_max, x_max]
 * normalized to [0, 1000] for both axes, relative to the image content.
 *
 * The SVG uses viewBox="0 0 1000 1000" with preserveAspectRatio="xMidYMid meet"
 * which mirrors Cornerstone's default fit-to-viewport behaviour and keeps the
 * boxes aligned with the rendered image for typical medical images (near-square
 * aspect ratios such as chest X-rays).
 */
export function AIFindingsOverlay({ findings, className }: AIFindingsOverlayProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (findings.length === 0) return null;

  return (
    <svg
      className={cn('absolute inset-0 w-full h-full pointer-events-none', className)}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      aria-label={`${findings.length} KI-Befunde`}
    >
      {findings.map((finding, index) => {
        const [y1, x1, y2, x2] = finding.box_2d;
        const width = x2 - x1;
        const height = y2 - y1;
        const isHovered = hoveredIndex === index;
        const { stroke, fill, labelBg } = getBoxColors(finding);

        // Label: place above the box; if box is at the very top, place below instead
        const labelY = y1 > 40 ? y1 - 6 : y2 + 20;
        const labelAnchorX = Math.min(x1 + 4, 950);

        return (
          <g
            key={index}
            className="pointer-events-auto cursor-pointer"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Bounding box rectangle */}
            <rect
              x={x1}
              y={y1}
              width={width}
              height={height}
              fill={isHovered ? fill.hovered : fill.normal}
              stroke={stroke}
              strokeWidth={isHovered ? 4 : 2.5}
              strokeLinejoin="round"
            />

            {/* Corner accents for cleaner look */}
            <CornerAccents x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} />

            {/* Label background */}
            <rect
              x={labelAnchorX - 2}
              y={labelY - 14}
              width={estimateLabelWidth(finding.label, finding.confidence)}
              height={17}
              rx={3}
              fill={labelBg}
              opacity={isHovered ? 1 : 0.85}
            />

            {/* Label text */}
            <text
              x={labelAnchorX}
              y={labelY - 2}
              fontSize={11}
              fontFamily="ui-monospace, monospace"
              fontWeight="600"
              fill="white"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
            >
              {finding.label}
              {finding.confidence !== undefined && (
                <tspan opacity={0.8}> {Math.round(finding.confidence * 100)}%</tspan>
              )}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Small L-shaped accents at the corners of the bounding box. */
function CornerAccents({
  x1, y1, x2, y2, stroke,
}: {
  x1: number; y1: number; x2: number; y2: number; stroke: string;
}) {
  const len = 12;
  const w = 3;
  const corners = [
    // top-left
    `M${x1},${y1 + len} L${x1},${y1} L${x1 + len},${y1}`,
    // top-right
    `M${x2 - len},${y1} L${x2},${y1} L${x2},${y1 + len}`,
    // bottom-left
    `M${x1},${y2 - len} L${x1},${y2} L${x1 + len},${y2}`,
    // bottom-right
    `M${x2 - len},${y2} L${x2},${y2} L${x2},${y2 - len}`,
  ];
  return (
    <>
      {corners.map((d, i) => (
        <path key={i} d={d} stroke={stroke} strokeWidth={w} fill="none" strokeLinecap="round" />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PATHOLOGICAL_KEYWORDS = [
  'rundherd', 'nodule', 'mass', 'tumor', 'infiltrat', 'erguss', 'effusion',
  'fraktur', 'fracture', 'atelektase', 'atelectasis', 'lesion', 'läsion',
  'konsolidierung', 'consolidation', 'pneumonie', 'pneumonia', 'ödem', 'edema',
  'vergrößer', 'enlarged', 'patholog',
];

const ANATOMICAL_KEYWORDS = [
  'lunge', 'lung', 'mediastinum', 'zwerchfell', 'diaphragm', 'herz', 'heart',
  'herzsilhouette', 'rippe', 'rib', 'wirbel', 'vertebra', 'trachea', 'knochen',
  'bone', 'hilus', 'hilum', 'aorta', 'gefäß', 'vessel',
];

type BoxColors = {
  stroke: string;
  fill: { normal: string; hovered: string };
  labelBg: string;
};

function getBoxColors(finding: FindingBox): BoxColors {
  const labelLower = finding.label.toLowerCase();

  const isPathological = PATHOLOGICAL_KEYWORDS.some((kw) => labelLower.includes(kw));
  const isAnatomical = !isPathological && ANATOMICAL_KEYWORDS.some((kw) => labelLower.includes(kw));

  if (isPathological) {
    // Red-orange for pathological findings
    return {
      stroke: 'rgba(239, 68, 68, 0.95)',
      fill: {
        normal: 'rgba(239, 68, 68, 0.08)',
        hovered: 'rgba(239, 68, 68, 0.18)',
      },
      labelBg: 'rgba(185, 28, 28, 0.92)',
    };
  }

  if (isAnatomical) {
    // Cyan-blue for anatomical structures
    return {
      stroke: 'rgba(6, 182, 212, 0.90)',
      fill: {
        normal: 'rgba(6, 182, 212, 0.06)',
        hovered: 'rgba(6, 182, 212, 0.15)',
      },
      labelBg: 'rgba(8, 145, 178, 0.90)',
    };
  }

  // Amber as default
  return {
    stroke: 'rgba(245, 158, 11, 0.90)',
    fill: {
      normal: 'rgba(245, 158, 11, 0.07)',
      hovered: 'rgba(245, 158, 11, 0.16)',
    },
    labelBg: 'rgba(180, 83, 9, 0.90)',
  };
}

/** Rough character-count-based width estimate for the label background rect. */
function estimateLabelWidth(label: string, confidence?: number): number {
  const text = confidence !== undefined
    ? `${label} ${Math.round(confidence * 100)}%`
    : label;
  return Math.min(text.length * 6.5 + 8, 400);
}
