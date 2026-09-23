import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminUsers } from "./useAdminUsers";
import { UsersToolbar } from "./UsersToolbar";
import { Pagination } from "./Pagination";
import {
  EmailCell, EmptyRow, ErrorRow, SortableHead, TableSkeletonRows, UserCell,
  VerificationBadge, formatDate, formatRelative,
} from "./shared";
import { DEFAULT_SCOPE_STATE, type ScopeState, type SortColumn } from "./types";

const COLS = 7;

export function HostsTable() {
  const [state, setState] = useState<ScopeState>(DEFAULT_SCOPE_STATE);
  const patch = (p: Partial<ScopeState>) => setState((s) => ({ ...s, ...p }));

  const query = useAdminUsers("host", state);
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  const onSort = (column: SortColumn) => {
    if (state.sortColumn === column) {
      patch({ sortDirection: state.sortDirection === "asc" ? "desc" : "asc" });
    } else {
      patch({ sortColumn: column, sortDirection: "desc" });
    }
  };

  return (
    <div className="space-y-4">
      <UsersToolbar
        scope="host"
        state={state}
        onChange={patch}
        totalLabel={query.isLoading ? "Loading…" : `${total} ${total === 1 ? "host" : "hosts"}`}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Host"
                column="display_name"
                activeColumn={state.sortColumn}
                direction={state.sortDirection}
                onSort={onSort}
              />
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground">Email</TableHead>
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground">Verification</TableHead>
              <SortableHead
                label="Verified"
                column="verified_at"
                activeColumn={state.sortColumn}
                direction={state.sortDirection}
                onSort={onSort}
              />
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground text-right">Listings</TableHead>
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground text-right">Bookings</TableHead>
              <SortableHead
                label="Joined"
                column="joined_at"
                activeColumn={state.sortColumn}
                direction={state.sortDirection}
                onSort={onSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading && <TableSkeletonRows cols={COLS} />}
            {query.isError && <ErrorRow cols={COLS} message={(query.error as Error).message} />}
            {!query.isLoading && !query.isError && rows.length === 0 && (
              <EmptyRow cols={COLS} label="No hosts match these filters." />
            )}
            {!query.isLoading && !query.isError && rows.map((row) => (
              <TableRow key={row.user_id}>
                <TableCell><UserCell row={row} /></TableCell>
                <TableCell><EmailCell email={row.email} /></TableCell>
                <TableCell><VerificationBadge status={row.host_verification_status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(row.verified_at)}</TableCell>
                <TableCell className="text-sm tabular-nums text-right">{row.total_listings ?? 0}</TableCell>
                <TableCell className="text-sm tabular-nums text-right">{row.total_bookings ?? 0}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatRelative(row.joined_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={state.page}
        pageSize={state.pageSize}
        total={total}
        onPageChange={(p) => patch({ page: p })}
      />
    </div>
  );
}
