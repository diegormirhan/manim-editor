// Single source for the persisted contract. Run scripts/generate-schema.mjs after editing.

const described = (description, schema) => ({ ...schema, description });
const number = { type: "number" };
const integer = (minimum, maximum) => ({ type: "integer", minimum, maximum });
const integerFrom = (minimum) => ({ type: "integer", minimum });
const vector3 = described("[x, y, z] in scene units. The frame spans x −7.11 to 7.11 and y −4 to 4; z is ignored.",
  { type: "array", items: number, minItems: 3, maxItems: 3 });
const range = { type: "array", items: number, minItems: 2, maxItems: 2 };
const hexColor = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
const identifier = { type: "string", minLength: 1 };
const reference = described("The key of another element in scene.elements.", identifier);
const positive = { type: "number", exclusiveMinimum: 0 };
const bounded = (minimum, maximum) => ({ type: "number", minimum, maximum });
const strings = (maxItems) => ({ type: "array", items: identifier, minItems: 1, maxItems });

export const SHARED_PROPERTIES = {
  position: described("Where the element's centre sits; a line's start point.", vector3),
  appearsAtMs: described("When the element enters, in milliseconds from the scene start.", integerFrom(0)),
  disappearsAtMs: described("When the element leaves. Omit it to keep the element until the scene ends.", integerFrom(1)),
  layer: described("The timeline layer. Higher layers draw on top; elements on one layer cannot overlap in time.", integer(0, 99)),
  color: hexColor,
  scale: bounded(0.05, 10),
  rotationDegrees: described("Counterclockwise.", bounded(-360, 360)),
  opacity: bounded(0, 1),
};

const fontSize = bounded(8, 144);
const size = bounded(0.05, 20);
const angles = { radius: positive, angleDegrees: bounded(-360, 360), startDegrees: bounded(-360, 360) };
const axisProperties = {
  xRange: range,
  yRange: range,
  xLength: bounded(0.1, 30),
  yLength: bounded(0.1, 30),
};

// Each entry lists only what the kind adds; `required` names its own mandatory fields.
export const ELEMENTS = {
  mathTex: { required: ["latex"], properties: { latex: described("LaTeX math, without $ delimiters.", identifier), fontSize } },
  tex: { required: ["latex"], properties: { latex: described("LaTeX text; math goes between $ signs.", identifier), fontSize } },
  text: { required: ["text"], properties: { text: identifier, fontSize } },
  decimalNumber: {
    required: ["value"],
    properties: { value: number, decimals: integer(0, 6), fontSize },
  },
  bulletedList: { required: ["items"], properties: { items: described("One LaTeX text line per bullet.", strings(12)), fontSize } },
  matrix: {
    required: ["rows"],
    properties: { rows: described("Rows of LaTeX entries; every row has as many entries as the first.",
      { type: "array", items: strings(8), minItems: 1, maxItems: 8 }) },
  },
  code: {
    required: ["code"],
    properties: {
      code: { type: "string", minLength: 1, maxLength: 4000 },
      language: { enum: ["python", "javascript", "typescript", "c", "cpp", "java", "rust", "go", "bash", "sql"] },
    },
  },
  circle: { required: ["radius"], properties: { radius: positive } },
  dot: { required: ["radius"], properties: { radius: positive } },
  ellipse: { required: ["width", "height"], properties: { width: positive, height: positive } },
  rectangle: { required: ["width", "height"], properties: { width: positive, height: positive } },
  roundedRectangle: {
    required: ["width", "height"],
    properties: { width: positive, height: positive, cornerRadius: bounded(0, 10) },
  },
  square: { required: ["size"], properties: { size } },
  triangle: { required: ["size"], properties: { size } },
  regularPolygon: { required: ["sides", "size"], properties: { sides: integer(3, 12), size } },
  star: { required: ["points", "radius"], properties: { points: integer(3, 12), radius: positive } },
  annulus: { required: ["innerRadius", "radius"], properties: { innerRadius: positive, radius: positive } },
  arc: { required: ["radius", "angleDegrees"], properties: angles },
  sector: { required: ["radius", "angleDegrees"], properties: angles },
  line: { required: ["end"], properties: { end: vector3 } },
  dashedLine: { required: ["end"], properties: { end: vector3 } },
  arrow: { required: ["end"], properties: { end: vector3 } },
  doubleArrow: { required: ["end"], properties: { end: vector3 } },
  brace: {
    required: ["targetId"],
    properties: {
      targetId: reference,
      direction: { enum: ["down", "up", "left", "right"] },
      label: described("Optional LaTeX math beside the brace.", { type: "string", maxLength: 120 }),
    },
  },
  surroundingRectangle: { required: ["targetId"], properties: { targetId: reference, buff: bounded(0, 2) } },
  axes: { required: ["xRange", "yRange"], properties: axisProperties },
  numberPlane: { required: ["xRange", "yRange"], properties: axisProperties },
  numberLine: {
    required: ["xRange"],
    properties: { xRange: range, xLength: bounded(0.1, 30), includeNumbers: { type: "boolean" } },
  },
  functionGraph: {
    required: ["expression", "xRange"],
    properties: {
      expression: described("Restricted notation such as x^2, sin(2x)/2 or 0.5x^2 - 1; never Python.",
        { type: "string", minLength: 1, maxLength: 120 }),
      xRange: range,
      axesId: reference,
    },
  },
  areaUnderGraph: {
    required: ["graphId", "xRange"],
    properties: { graphId: reference, xRange: range },
  },
  barChart: {
    required: ["values"],
    properties: {
      values: { type: "array", items: number, minItems: 1, maxItems: 20 },
      labels: described("One LaTeX label per bar, in order.", { type: "array", items: { type: "string" }, maxItems: 20 }),
    },
  },
};

export const ANIMATION_KINDS = [
  "create", "write", "fadeIn", "grow", "drawBorder",
  "fadeOut", "moveTo", "transform", "rotate", "scaleTo", "recolor",
  "indicate", "wiggle", "parallel",
];

// A clip carries exactly the extra field its kind names here.
export const ANIMATION_FIELDS = {
  moveTo: "destination",
  transform: "destinationId",
  rotate: "degrees",
  scaleTo: "factor",
  recolor: "color",
};

function elementSchema(kind, definition) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["kind", "position", "appearsAtMs", ...definition.required],
    properties: { kind: { const: kind }, ...SHARED_PROPERTIES, ...definition.properties },
  };
}

export function buildSchema() {
  const defs = Object.fromEntries(
    Object.entries(ELEMENTS).map(([kind, definition]) => [kind, elementSchema(kind, definition)]),
  );
  defs.animation = described(
    "One animation of one element. Animations of different elements may overlap in time; one element plays one at a time. "
      + "Entrances (create, write, fadeIn, grow, drawBorder) start when their element appears; fadeOut and transform end it.",
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "startMs", "durationMs"],
      properties: {
        kind: described("parallel only appears in older files; overlapping animations replace it.", { enum: ANIMATION_KINDS }),
        targetId: reference,
        startMs: integerFrom(0),
        durationMs: integerFrom(67),
        destination: described("moveTo: where the element's centre ends up.", vector3),
        destinationId: described("transform: an element that stays hidden until the transform ends, then replaces the target.", reference),
        degrees: described("rotate: counterclockwise turn.", bounded(-1080, 1080)),
        factor: described("scaleTo: relative scale.", bounded(0.05, 10)),
        color: described("recolor: the final colour.", hexColor),
        clips: { type: "array", minItems: 2, items: { $ref: "#/$defs/animation" } },
      },
    },
  );
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Manim editor project",
    description: "A Manim animation as data. Times are integer milliseconds and snap to a 15 fps grid; "
      + "positions are scene units with the origin at the frame's centre.",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "name", "scene"],
    properties: {
      schemaVersion: { const: 1 },
      name: { type: "string", minLength: 1 },
      scene: {
        type: "object",
        additionalProperties: false,
        required: ["durationMs", "elements"],
        properties: {
          durationMs: integerFrom(1),
          background: hexColor,
          elements: described("Elements by identifier. Any unique string works as a key.", {
            type: "object",
            additionalProperties: {
              oneOf: Object.keys(ELEMENTS).map((kind) => ({ $ref: `#/$defs/${kind}` })),
            },
          }),
          animations: { type: "array", items: { $ref: "#/$defs/animation" } },
        },
      },
    },
    $defs: defs,
  };
}
