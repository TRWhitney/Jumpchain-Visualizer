import { describe, expect, it } from "vitest";
import {
  tagDefinitionForDisplay,
  tagDefinitionForReference,
  tagDefinitionsWithFallbacks,
  tagReferenceId,
  type TagDefinition,
} from "./tags";

describe("Tag references", () => {
  it("resolves author strings through the User profile id, label, and aliases", () => {
    const physical: TagDefinition = {
      id: "physical",
      label: "Physical",
      aliases: ["Strength and fitness"],
      color: "#123456",
      to: "#654321",
      style: "gradient",
    };
    const definitions = { physical };

    expect(tagReferenceId("  PHYSICAL  ")).toBe("physical");
    expect(tagDefinitionForReference(definitions, "Physical")).toBe(physical);
    expect(tagDefinitionForReference(definitions, "strength_and-fitness")).toBe(
      physical,
    );
  });

  it("renders unknown authored strings as read-only Miscellaneous fallbacks", () => {
    const miscellaneous: TagDefinition = {
      id: "miscellaneous",
      label: "Miscellaneous",
      aliases: [],
      color: "#123456",
      to: "#654321",
      style: "gradient",
    };
    const definitions = { miscellaneous };

    const pokemon = tagDefinitionForDisplay(definitions, "Pokémon")!;
    expect(pokemon).toMatchObject({
      id: "pokémon",
      label: "Pokémon",
      parent: "miscellaneous",
      aliases: [],
    });
    expect(pokemon.presentation).toBeDefined();
    expect(pokemon.presentation?.colors).not.toEqual(
      miscellaneous.presentation?.colors,
    );
    const expanded = tagDefinitionsWithFallbacks(definitions, [
      "Information",
      "Pokémon",
    ]);
    expect(expanded.information).toMatchObject({
      label: "Information",
      parent: "miscellaneous",
      style: miscellaneous.style,
    });
    expect(expanded["pokémon"].label).toBe("Pokémon");
    expect(definitions).toEqual({ miscellaneous });
    expect(definitions).not.toHaveProperty("information");
  });
});
