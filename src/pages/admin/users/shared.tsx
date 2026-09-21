import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { AdminUserRow, SortColumn, SortDirection } from "./types";
import type { AppRole } from "@/lib/rbac";

export function initialsOf(name: string | null, fallback: string) {
  const label = name?.trim() || fallback.slice(0, 8);
  return (
    label
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "U"
  );
}

export function UserCell({ row }: { row: AdminUserRow }) {
  const name = row.display_name?.trim() || row.user_id.slice(0, 8);
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar className="h-8 w-8 shrink-0">
        {row.avatar_url ? <AvatarImage src={row.avatar_url} alt={name} /> : null}
        <AvatarFallback className="text-[11px]">
          {initialsOf(row.display_name, row.user_id)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-[11px] text-muted-foreground font-mono truncate">
          {row.user_id.slice(0, 8)}…
        </p>
      </div>
    </div>
  );
}

export function EmailCell({ email }: { email: string | null }) {
  if (!email) return <span className="text-muted-foreground text-xs">—</span>;
  return <span className="text-sm truncate block max-w-[260px]" title={email}>{email}</span>;
}

const ROLE_TONE: Record<AppRole, string> = {
  admin: "bg-primary text-primary-foreground",
  host: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20",
  member: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
  user: "bg-muted text-muted-foreground border border-border",
};

export function RoleBadges({ roles }: { roles: AppRole[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {roles.map((r) => (
        <span
          key={r}
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${ROLE_TONE[r]}`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

const VERIFICATION_TONE: Record<string, string> = {
  verified: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20",
  unverified: "bg-muted text-muted-foreground border border-border",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/20",
};

export function VerificationBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? "unverified";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${VERIFICATION_TONE[s] ?? VERIFICATION_TONE.unverified}`}
    >
      {s}
    </span>
  );
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export function formatRelative(iso: string | null | undefined) {
  if (!iso) return <span className="text-muted-foreground">Never</span>;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

type SortableHeadProps = {
  label: string;
  column: SortColumn;
  activeColumn: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  className?: string;
};

export function SortableHead({
  label, column, activeColumn, direction, onSort, className,
}: SortableHeadProps) {
  const active = activeColumn === column;
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium tracking-wide ${
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        } transition-colors`}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TableHead>
  );
}

export function TableSkeletonRows({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full max-w-[160px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function ErrorRow({ cols, message }: { cols: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-8">
        <div className="text-sm text-red-600 dark:text-red-400">
          Couldn't load users: {message}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function EmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-10 text-center text-sm text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

