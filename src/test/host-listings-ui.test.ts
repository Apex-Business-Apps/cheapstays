import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Static assertions on the refactored /host/listings UI. These catch
// accidental regressions of the three deliberate UX decisions made in
// the refactor without requiring a full-DOM render harness.
describe("/host/listings refactor invariants", () => {
  const src = readFileSync("src/pages/host/ListingsPage.tsx", "utf8");

  it("opens the public listing in a new tab so the host keeps their dashboard tab", () => {
    expect(src).toContain('target="_blank"');
    expect(src).toContain('rel="noopener noreferrer"');
  });

  it("uses the row-variant carousel for the thumbnail", () => {
    expect(src).toContain("ListingPhotoCarousel");
    expect(src).toMatch(/variant="row"/);
  });

  it("mounts the EditListingDialog for inline editing", () => {
    expect(src).toContain('from "@/components/host/EditListingDialog"');
    expect(src).toContain("EditListingDialog");
  });

  it("preserves the two-step delete-with-deactivate-fallback flow", () => {
    expect(src).toContain('err?.code === "23503"');
    expect(src).toContain('.update({ status: "inactive" })');
    expect(src).toContain("Listing deactivated");
  });

  it("does not re-embed the ImageUploader / VideoUploader inline (moved into Edit modal)", () => {
    expect(src).not.toContain("ImageUploader");
    expect(src).not.toContain("VideoUploader");
  });
});

describe("EditListingDialog invariants", () => {
  const src = readFileSync("src/components/host/EditListingDialog.tsx", "utf8");

  it("commits a single UPDATE at the end, scoped to the host's own listing", () => {
    // Double-filter matches the RLS policy in 20260521130000_security_hardening.sql:33-44
    expect(src).toContain('.from("listings")');
    expect(src).toMatch(/\.update\(payload\)[\s\S]*\.eq\("id", listing\.id\)[\s\S]*\.eq\("host_id", userId\)/);
  });

  it("uses six steps in the labeled order the plan specifies", () => {
    expect(src).toContain('"Basics", "Location", "Type & booking", "Capacity & pricing", "Amenities", "Media"');
  });

  it("guards close-while-dirty with an AlertDialog", () => {
    expect(src).toContain("AlertDialog");
    expect(src).toContain("Discard your changes");
  });

  it("blocks Save while ImageUploader is still uploading", () => {
    expect(src).toContain("imagesUploading");
    expect(src).toContain("Uploading photos");
  });
});
