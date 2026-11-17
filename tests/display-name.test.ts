import {describe,it,expect} from "vitest";
import {displayName} from "../src/integration/display-name";
describe("public presentation without changing identity",()=>{
 it("hides absent names and known fixture/numeric fallbacks",()=>{
  expect(displayName(undefined,"123")).toBe("Participante");
  expect(displayName("  ","internal")).toBe("Participante");
  expect(displayName("viewer-0","viewer-0")).toBe("Participante");
  expect(displayName("123","123")).toBe("Participante");
 });
 it("retains public names, accents and emoji",()=>{
  const participant={id:"viewer-0",name:"  María José 🪩✨  ",score:900};
  expect(displayName(participant.name,participant.id)).toBe("María José 🪩✨");
  expect(participant.id).toBe("viewer-0");expect(participant.score).toBe(900);
  expect(displayName("viewer-0","different-id")).toBe("viewer-0");
 });
});
