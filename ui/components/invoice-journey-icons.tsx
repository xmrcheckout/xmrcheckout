/*
 * Object icons are Phosphor Icons duotone paths (@phosphor-icons/core 2.1.1),
 * MIT License, Copyright (c) 2023 Phosphor Icons. Full notice:
 * https://github.com/phosphor-icons/core/blob/main/LICENSE
 *
 * The coin uses the official Monero mark from public/monero-logo.svg, unmodified.
 */
const icons = {
  phone: {
    tint: "M192,56V200H64V56Z",
    line: "M176,16H80A24,24,0,0,0,56,40V216a24,24,0,0,0,24,24h96a24,24,0,0,0,24-24V40A24,24,0,0,0,176,16ZM72,64H184V192H72Zm8-32h96a8,8,0,0,1,8,8v8H72V40A8,8,0,0,1,80,32Zm96,192H80a8,8,0,0,1-8-8v-8H184v8A8,8,0,0,1,176,224Z",
  },
  wallet: {
    tint: "M224,80V192a8,8,0,0,1-8,8H56a16,16,0,0,1-16-16V56A16,16,0,0,0,56,72H216A8,8,0,0,1,224,80Z",
    line: "M216,64H56a8,8,0,0,1,0-16H192a8,8,0,0,0,0-16H56A24,24,0,0,0,32,56V184a24,24,0,0,0,24,24H216a16,16,0,0,0,16-16V80A16,16,0,0,0,216,64Zm0,128H56a8,8,0,0,1-8-8V78.63A23.84,23.84,0,0,0,56,80H216Zm-48-60a12,12,0,1,1,12,12A12,12,0,0,1,168,132Z",
  },
  storefront: {
    tint: "M224,96v16a32,32,0,0,1-64,0V96H96v16a32,32,0,0,1-64,0V96L46.34,45.8A8,8,0,0,1,54,40H202a8,8,0,0,1,7.69,5.8Z",
    line: "M231.69,93.81,217.35,43.6A16.07,16.07,0,0,0,202,32H54A16.07,16.07,0,0,0,38.65,43.6L24.31,93.81A7.94,7.94,0,0,0,24,96v16a40,40,0,0,0,16,32v72a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V144a40,40,0,0,0,16-32V96A7.94,7.94,0,0,0,231.69,93.81ZM54,48H202l11.42,40H42.61Zm98,56v8a24,24,0,0,1-48,0v-8ZM51.06,132.2A24,24,0,0,1,40,112v-8H88v8a24,24,0,0,1-35.12,21.26A7.88,7.88,0,0,0,51.06,132.2ZM200,208H56V151.2a40.57,40.57,0,0,0,8,.8,40,40,0,0,0,32-16,40,40,0,0,0,64,0,40,40,0,0,0,32,16,40.57,40.57,0,0,0,8-.8Zm16-96a24,24,0,0,1-11.07,20.2,8.08,8.08,0,0,0-1.8,1.05A24,24,0,0,1,168,112v-8h48Z",
  },
} as const;

const moneroPaths = [
  { d: "M4128,2249.81C4128,3287,3287.26,4127.86,2250,4127.86S372,3287,372,2249.81,1212.76,371.75,2250,371.75,4128,1212.54,4128,2249.81Z", fill: "#fff" },
  { d: "M2250,371.75c-1036.89,0-1879.12,842.06-1877.8,1878,0.26,207.26,33.31,406.63,95.34,593.12h561.88V1263L2250,2483.57,3470.52,1263v1579.9h562c62.12-186.48,95-385.85,95.37-593.12C4129.66,1212.76,3287,372,2250,372Z", fill: "#f26822" },
  { d: "M1969.3,2764.17l-532.67-532.7v994.14H1029.38l-384.29.07c329.63,540.8,925.35,902.56,1604.91,902.56S3525.31,3766.4,3855,3225.6H3063.25V2231.47l-532.7,532.7-280.61,280.61-280.62-280.61h0Z", fill: "#4d4d4d" },
] as const;

export type JourneyIconName = keyof typeof icons;

type JourneyIconProps = {
  name: JourneyIconName;
  x: number;
  y: number;
  size: number;
  tint?: string;
  line?: string;
};

export function JourneyIcon({ name, x, y, size, tint = "#d9c4a5", line = "#101217" }: JourneyIconProps) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 256 256" aria-hidden="true">
      <path d={icons[name].tint} fill={tint} />
      <path d={icons[name].line} fill={line} />
    </svg>
  );
}

type MoneroCoinProps = { cx: number; cy: number; r: number; className: string };

export function MoneroCoin({ cx, cy, r, className }: MoneroCoinProps) {
  return (
    <g className={className} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r + 1.5} fill="#fffaf2" />
      <svg x={cx - r} y={cy - r} width={r * 2} height={r * 2} viewBox="0 0 3756.09 3756.49">
        {moneroPaths.map((path) => (
          <path key={path.fill} d={path.d} fill={path.fill} transform="translate(-371.96 -371.75)" />
        ))}
      </svg>
    </g>
  );
}
