import { describe, expect, it } from "vitest";
import {
  implicitNamedBasicChoiceValue,
  namedBasicChoiceSelectionIsCompatible,
  namedBasicValueFromChoiceName,
} from "./basicProperties";

describe("implicit basic properties", () => {
  it("accepts every valid non-integer named basic Choice selection", () => {
    expect(namedBasicChoiceSelectionIsCompatible("toggle")).toBe(true);
    expect(namedBasicChoiceSelectionIsCompatible("text")).toBe(true);
    expect(namedBasicChoiceSelectionIsCompatible("select")).toBe(true);
    expect(namedBasicChoiceSelectionIsCompatible("companions")).toBe(true);
    expect(namedBasicChoiceSelectionIsCompatible("integer")).toBe(false);
    expect(namedBasicChoiceSelectionIsCompatible("invalid")).toBe(false);
  });

  it("uses a scalar answer when one exists and otherwise uses the Choice name", () => {
    expect(
      implicitNamedBasicChoiceValue(
        "location",
        "select",
        "Crossroads",
        "Starting place",
      ),
    ).toBe("Crossroads");
    expect(
      implicitNamedBasicChoiceValue(
        "location",
        "toggle",
        true,
        "Coastal village",
      ),
    ).toBe("Coastal village");
    expect(
      implicitNamedBasicChoiceValue(
        "origin",
        "companions",
        ["aster"],
        "Traveling camp",
      ),
    ).toBe("Traveling camp");
    expect(
      implicitNamedBasicChoiceValue("origin", "integer", 3, "District"),
    ).toBeUndefined();
  });

  it("extracts a parenthesized value only after the matching literal prefix", () => {
    expect(
      namedBasicValueFromChoiceName("location", "Location (Poolside)"),
    ).toBe("Poolside");
    expect(
      namedBasicValueFromChoiceName(
        "location",
        "Location( Moon Base ) details",
      ),
    ).toBe("Moon Base");
    expect(namedBasicValueFromChoiceName("origin", "Origin (Local)")).toBe(
      "Local",
    );
    expect(namedBasicValueFromChoiceName("origin", "Location (Poolside)")).toBe(
      "Location (Poolside)",
    );
    expect(
      namedBasicValueFromChoiceName("location", "Starting Location (Poolside)"),
    ).toBe("Starting Location (Poolside)");
    expect(
      namedBasicValueFromChoiceName("location", "location (Poolside)"),
    ).toBe("location (Poolside)");
  });
});
