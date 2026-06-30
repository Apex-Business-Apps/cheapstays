import { Link } from "react-router-dom";

// Shared Help Center FAQ — used by Customer Support and About Us.
export const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "How do I book a stay?",
    a: "Open a listing, pick your dates and number of guests in the booking panel, then confirm. Instant-book listings are confirmed right away; others are sent to the host for approval.",
  },
  {
    q: "How do I pay?",
    a: "Payments are processed securely through PayMongo — GCash, Maya, or card — at checkout. CheapStays never stores your card details.",
  },
  {
    q: "Can I cancel and get a refund?",
    a: (
      <>
        Yes — free cancellation up to 2 days before check-in. Within 2 days of check-in the booking is
        non-refundable. See the full{" "}
        <Link to="/refunds" className="underline underline-offset-4">Refund Policy</Link>.
      </>
    ),
  },
  {
    q: "When does the host get paid?",
    a: "Host payouts are released 1 day after check-in, so guests have time to confirm everything is as described.",
  },
  {
    q: "How do I become a host?",
    a: (
      <>
        Apply on{" "}
        <Link to="/become-a-partner" className="underline underline-offset-4">Become a Partner</Link> —
        verify your ID, and once approved you can create and publish listings from Host tools.
      </>
    ),
  },
  {
    q: "I have a problem with a booking — what do I do?",
    a: (
      <>
        Send us a message using the contact form or email{" "}
        <a href="mailto:cheapstays.me@gmail.com" className="underline underline-offset-4">cheapstays.me@gmail.com</a>.
        Signed-in users can also open a ticket from{" "}
        <Link to="/support" className="underline underline-offset-4">Support</Link>.
      </>
    ),
  },
];
