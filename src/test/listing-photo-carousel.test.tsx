import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListingPhotoCarousel } from "@/components/ListingPhotoCarousel";

describe("ListingPhotoCarousel", () => {
  it("returns null with no images", () => {
    const { container } = render(<ListingPhotoCarousel images={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("row variant with a single image renders a static thumbnail (no nav controls)", () => {
    render(<ListingPhotoCarousel images={["/a.jpg"]} title="Test" variant="row" />);
    expect(screen.queryByLabelText(/next photo/i)).toBeNull();
    expect(screen.queryByLabelText(/previous photo/i)).toBeNull();
    expect(screen.getByAltText(/test/i)).toBeInTheDocument();
  });

  it("row variant with multiple images exposes navigation controls", () => {
    render(<ListingPhotoCarousel images={["/a.jpg", "/b.jpg", "/c.jpg"]} title="Multi" variant="row" />);
    expect(screen.getByLabelText(/next photo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/previous photo/i)).toBeInTheDocument();
  });

  it("hero variant renders a thumbnail strip below the carousel", () => {
    render(<ListingPhotoCarousel images={["/a.jpg", "/b.jpg"]} title="Hero" variant="hero" />);
    expect(screen.getAllByLabelText(/jump to photo/i).length).toBeGreaterThan(0);
  });
});
