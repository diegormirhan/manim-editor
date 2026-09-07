// Single source for the persisted contract. Run scripts/generate-schema.mjs after editing.

const number = { type: "number" };
const integerFrom = (minimum) => ({ type: "integer", minimum });
const vector3 = { type: "array", items: number, minItems: 3, maxItems: 3 };
const range = { type: "array", items: number, minItems: 2, maxItems: 2 };
const hexColor = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
const identifier = { type: "string", minLength: 1 };
const positive = { type: "number", exclusiveMinimum: 0 };
const bounded = (minimum, maximum) => ({ type: "number", minimum, maximum });

const SHARED_PROPERTIES = {
  position: vector3,
  appearsAtMs: integerFrom(0),
  disappearsAtMs: integerFrom(1),
  color: hexColor,
  scale: bounded(0.05, 10),
  rotationDegrees: bounded(-360, 360),
  opacity: bounded(0, 1),
};

const fontSize = bounded(8, 144);
const axisProperties = {
  xRange: range,
  yRange: range,
  xLength: bounded(0.1, 30),
  yLength: bounded(0.1, 30),
};

// Each entry lists only what the kind adds; `required` names its own mandatory fields.
export const ELEMENTS = {
  mathTex: { required: ["latex"], properties: { latex: identifier, fontSize } },
  text: { required: ["text"], properties: { text: identifier, fontSize } },
  circle: { required: ["radius"], properties: { radius: positive } },
  dot: { required: ["radius"], properties: { radius: positive } },
  ellipse: { required: ["width", "height"], properties: { width: positive, height: positive } },
  rectangle: { required: ["width", "height"], properties: { width: positive, height: positive } },
  square: { required: ["size"], properties: { size: bounded(0.05, 20) } },
  triangle: { required: ["size"], properties: { size: bounded(0.05, 20) } },
  regularPolygon: {
    required: ["sides", "size"],
    properties: { sides: { type: "integer", minimum: 3, maximum: 12 }, size: bounded(0.05, 20) },
  },
  arc: {
    required: ["radius", "angleDegrees"],
    properties: { radius: positive, angleDegrees: bounded(-360, 360), startDegrees: bounded(-360, 360) },
  },
  line: { required: ["end"], properties: { end: vector3 } },
  arrow: { required: ["end"], properties: { end: vector3 } },
  axes: { required: ["xRange", "yRange"], properties: axisProperties },
  numberPlane: { required: ["xRange", "yRange"], properties: axisProperties },
  numberLine: {
    required: ["xRange"],
    properties: { xRange: range, xLength: bounded(0.1, 30), includeNumbers: { type: "boolean" } },
  },
  functionGraph: {
    required: ["expression", "xRange"],
    properties: {
      expression: { type: "string", minLength: 1, maxLength: 120 },
      xRange: range,
      axesId: identifier,
    },
  },
  areaUnderGraph: {
    required: ["graphId", "xRange"],
    properties: { graphId: identifier, xRange: range },
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
  defs.animation = {
    type: "object",
    additionalProperties: false,
    required: ["kind", "startMs", "durationMs"],
    properties: {
      kind: { enum: ANIMATION_KINDS },
      targetId: identifier,
      startMs: integerFrom(0),
      durationMs: integerFrom(67),
      destination: vector3,
      destinationId: identifier,
      degrees: bounded(-1080, 1080),
      factor: bounded(0.05, 10),
      color: hexColor,
      clips: { type: "array", minItems: 2, items: { $ref: "#/$defs/animation" } },
    },
  };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Manim editor project",
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
          elements: {
            type: "object",
            additionalProperties: {
              oneOf: Object.keys(ELEMENTS).map((kind) => ({ $ref: `#/$defs/${kind}` })),
            },
          },
          animations: { type: "array", items: { $ref: "#/$defs/animation" } },
        },
      },
    },
    $defs: defs,
  };
}
