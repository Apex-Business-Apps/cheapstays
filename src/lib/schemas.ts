import { z } from "zod";

export const aiSearchSchema = z.object({
  query: z.string().min(2).max(500),
  filters: z
    .object({
      maxNightly: z.number().positive().optional(),
      minNights: z.number().int().positive().optional(),
      city: z.string().max(120).optional(),
    })
    .optional(),
});
export type AiSearchInput = z.infer<typeof aiSearchSchema>;

export const aiDescribeSchema = z.object({
  title: z.string().min(2).max(200),
  bullets: z.array(z.string().min(1).max(300)).min(1).max(20),
  tone: z.enum(["confident", "playful", "minimal"]).default("confident"),
});
export type AiDescribeInput = z.infer<typeof aiDescribeSchema>;

export const supportCategories = [
  "booking",
  "payment_refund",
  "host_verification",
  "property_condition",
  "incidentals_damage",
  "safety_privacy_surveillance",
  "account_access",
  "technical_bug",
] as const;

export const supportTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  message: z.string().min(5).max(4000),
  category: z.enum(supportCategories).default("booking"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});
export type SupportTicketInput = z.infer<typeof supportTicketSchema>;

export const supportMessageSchema = z.object({
  ticket_id: z.string().uuid(),
  content: z.string().min(1).max(4000),
});
export type SupportMessageInput = z.infer<typeof supportMessageSchema>;
