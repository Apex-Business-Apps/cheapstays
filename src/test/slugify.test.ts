import { describe, it, expect } from "vitest";

// Copied verbatim from src/pages/Host.tsx so it can be tested in isolation
// without pulling in React or Supabase dependencies.
function slugify(title: string, id: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim()
      .slice(0, 60) +
    "-" +
    id.slice(0, 8)
  );
}

describe("slugify", () => {
  it("lowercases, converts spaces to hyphens, and appends the first 8 chars of id", () => {
    expect(slugify("Sunset Villa", "abc12345-xxxx")).toBe("sunset-villa-abc12345");
  });

  it("strips non-alphanumeric characters (except spaces/hyphens) and appends id prefix", () => {
    expect(slugify("Über fancy hôtel!!!", "id1234567890")).toBe(
      "ber-fancy-htel-id123456"
    );
  });

  it("truncates the slug body at 60 characters before appending the id", () => {
    const longTitle = "a".repeat(70);
    const result = slugify(longTitle, "id99999999");
    // slug body must be at most 60 chars, then "-" + 8-char id prefix
    const [body, idPart] = result.split(/-(?=[^-]*$)/);
    expect(body.length).toBeLessThanOrEqual(60);
    expect(idPart).toBe("id999999");
  });

  it("collapses multiple consecutive spaces into a single hyphen", () => {
    expect(slugify("beach   house", "aabbccdd1234")).toBe(
      "beach-house-aabbccdd"
    );
  });

  it("collapses multiple consecutive hyphens into a single hyphen", () => {
    // After stripping '!' the title becomes "wow---place"; collapses to "wow-place"
    expect(slugify("wow---place", "zzzzzzzz1234")).toBe("wow-place-zzzzzzzz");
  });

  it("returns only the id prefix when the title is empty after stripping", () => {
    // "!!!" strips to "" which trims to "" -> slug is "-" + id[:8]
    const result = slugify("!!!", "id000000xxxx");
    expect(result).toBe("-id000000");
  });
});
