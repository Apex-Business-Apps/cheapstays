import { describe, it, expect } from "vitest";
import {
  aiSearchSchema,
  aiDescribeSchema,
  supportTicketSchema,
  supportMessageSchema,
} from "@/lib/schemas";
import { hasRole, isAdmin, isHost, isMember } from "@/lib/rbac";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// schemas
// ---------------------------------------------------------------------------

describe("schemas", () => {
  // --- aiSearchSchema -------------------------------------------------------

  describe("aiSearchSchema", () => {
    it("accepts a valid query", () => {
      const result = aiSearchSchema.safeParse({
        query: "beachfront villa in Palawan",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a query shorter than 2 characters", () => {
      const result = aiSearchSchema.safeParse({ query: "a" });
      expect(result.success).toBe(false);
    });

    it("rejects a query longer than 500 characters", () => {
      const result = aiSearchSchema.safeParse({ query: "x".repeat(501) });
      expect(result.success).toBe(false);
    });

    it("accepts optional filters with valid maxNightly, minNights, and city", () => {
      const result = aiSearchSchema.safeParse({
        query: "quiet cottage",
        filters: { maxNightly: 150, minNights: 2, city: "Palawan" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects filters with a negative maxNightly", () => {
      const result = aiSearchSchema.safeParse({
        query: "quiet cottage",
        filters: { maxNightly: -50 },
      });
      expect(result.success).toBe(false);
    });
  });

  // --- aiDescribeSchema -----------------------------------------------------

  describe("aiDescribeSchema", () => {
    it("accepts valid title, bullets, and tone", () => {
      const result = aiDescribeSchema.safeParse({
        title: "Sunset Villa",
        bullets: ["Pool", "WiFi"],
        tone: "playful",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an empty bullets array", () => {
      const result = aiDescribeSchema.safeParse({
        title: "Sunset Villa",
        bullets: [],
        tone: "confident",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid tone value", () => {
      const result = aiDescribeSchema.safeParse({
        title: "Sunset Villa",
        bullets: ["Pool"],
        tone: "casual",
      });
      expect(result.success).toBe(false);
    });
  });

  // --- supportTicketSchema --------------------------------------------------

  describe("supportTicketSchema", () => {
    it("accepts a valid subject, message, and priority", () => {
      const result = supportTicketSchema.safeParse({
        subject: "My booking",
        message: "I cannot find my reservation.",
        priority: "high",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a subject shorter than 3 characters", () => {
      const result = supportTicketSchema.safeParse({
        subject: "Hi",
        message: "I cannot find my reservation.",
        priority: "normal",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a message shorter than 5 characters", () => {
      const result = supportTicketSchema.safeParse({
        subject: "My booking",
        message: "Hey",
        priority: "low",
      });
      expect(result.success).toBe(false);
    });
  });

  // --- supportMessageSchema -------------------------------------------------

  describe("supportMessageSchema", () => {
    it("accepts a valid uuid ticket_id and content", () => {
      const result = supportMessageSchema.safeParse({
        ticket_id: "550e8400-e29b-41d4-a716-446655440000",
        content: "Please help me with my issue.",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a non-uuid ticket_id", () => {
      const result = supportMessageSchema.safeParse({
        ticket_id: "not-a-uuid",
        content: "Please help me with my issue.",
      });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// rbac
// ---------------------------------------------------------------------------

describe("rbac", () => {
  describe("hasRole", () => {
    it("returns true when the role is present in the list", () => {
      expect(hasRole(["admin", "host"], "admin")).toBe(true);
    });

    it("returns false when the role is absent from the list", () => {
      expect(hasRole(["user"], "admin")).toBe(false);
    });
  });

  describe("isAdmin", () => {
    it("returns true for an admin role", () => {
      expect(isAdmin(["admin"])).toBe(true);
    });

    it("returns false for a host role", () => {
      expect(isAdmin(["host"])).toBe(false);
    });
  });

  describe("isHost", () => {
    it("returns true for an explicit host role", () => {
      expect(isHost(["host"])).toBe(true);
    });

    it("returns true for an admin (admin implies host)", () => {
      expect(isHost(["admin"])).toBe(true);
    });

    it("returns false for a plain user role", () => {
      expect(isHost(["user"])).toBe(false);
    });
  });

  describe("isMember", () => {
    it("returns true for an explicit member role", () => {
      expect(isMember(["member"])).toBe(true);
    });

    it("returns true for an admin (admin implies member)", () => {
      expect(isMember(["admin"])).toBe(true);
    });

    it("returns false for a plain user role", () => {
      expect(isMember(["user"])).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------

describe("utils", () => {
  describe("cn", () => {
    it("merges two simple class strings", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("omits undefined values", () => {
      expect(cn("foo", undefined, "bar")).toBe("foo bar");
    });

    it("preserves distinct Tailwind utilities", () => {
      expect(cn("px-4", "py-2")).toBe("px-4 py-2");
    });

    it("ignores falsy conditional classes", () => {
      const condition = false as boolean;
      expect(cn("base", condition && "ignored")).toBe("base");
    });
  });
});
