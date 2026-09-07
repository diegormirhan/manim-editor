import { expect, test } from "vitest";
import { ANIMATION_FIELDS, ANIMATION_KINDS, ELEMENTS, buildSchema } from "../../contracts/schema.mjs";
import committed from "../../contracts/project.schema.json";
import { elementGroups, elementLabels } from "./catalog";
import { animationLabels, clipFields } from "./timeline";
import { validateProject } from "./project";

test("the committed schema matches its builder", () => {
  expect(committed).toEqual(buildSchema());
});
test("the catalog labels exactly the kinds the contract accepts", () => {
  expect(Object.keys(elementLabels).sort()).toEqual(Object.keys(ELEMENTS).sort());
  expect(Object.keys(animationLabels).sort()).toEqual([...ANIMATION_KINDS].sort());
  expect(clipFields).toEqual(ANIMATION_FIELDS);
});
const examples = import.meta.glob("../../examples/*.json", { eager: true, import: "default" });

test("the library groups cover every kind exactly once", () => {
  const grouped = elementGroups.flatMap((group) => group.kinds);
  expect(new Set(grouped).size).toBe(grouped.length);
  expect(grouped.sort()).toEqual(Object.keys(elementLabels).sort());
});
test("every bundled example validates through the shared contract", () => {
  const names = Object.keys(examples);
  expect(names.length).toBeGreaterThan(0);
  for (const name of names) expect(validateProject(examples[name]), name).toBeNull();
});
