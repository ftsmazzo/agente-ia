import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, toBrandTemplateContext } from "../dist/brand.js";

describe("renderTemplate", () => {
  it("replaces placeholders", () => {
    const brand = {
      brandName: "Example Realty",
      brandSlug: "example-realty",
      assistantName: "Assistant",
      assistantTitle: "consultant",
      defaultLocale: "pt-BR",
      timezone: "America/Sao_Paulo",
    };
    const ctx = toBrandTemplateContext(brand);
    const out = renderTemplate(
      "Hello, I am {{assistant_name}} from {{brand_name}}.",
      ctx,
    );
    assert.equal(out, "Hello, I am Assistant from Example Realty.");
  });
});
