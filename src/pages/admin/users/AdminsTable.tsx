import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminUsers } from "./useAdminUsers";
import { UsersToolbar } from "./UsersToolbar";
import { Pagination } from "./Pagination";
import {
  EmailCell, EmptyRow, ErrorRow, SortableHead, TableSkeletonRows, UserCell,
  formatDate, formatRelative,
} from "./shared";
import { DEFAULT_SCOPE_STATE, type ScopeState, type SortColumn } from "./types";

const COLS = 5;

export function AdminsTable() {
  const [state, setState] = useState<ScopeState>(DEFAULT_SCOPE_STATE);
  const patch = (p: Partial<ScopeState>) => setState((s) => ({ ...s, ...p }));

  const query = useAdminUsers("admin", state);
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
        scope="admin"
        state={state}
        onChange={patch}
        totalLabel={query.isLoading ? "Loading…" : `${total} ${total === 1 ? "admin" : "admins"}`}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Admin"
                column="display_name"
                activeColumn={state.sortColumn}
                direction={state.sortDirection}
                onSort={onSort}
              />
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground">Email</TableHead>
              <SortableHead
                label="Granted"
                column="joined_at"
                activeColumn={state.sortColumn}
                direction={state.sortDirection}
                onSort={onSort}
              />
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground">Granted by</TableHead>
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading && <TableSkeletonRows cols={COLS} />}
            {query.isError && <ErrorRow cols={COLS} message={(query.error as Error).message} />}
            {!query.isLoading && !query.isError && rows.length === 0 && (
              <EmptyRow cols={COLS} label="No admins match these filters." />
            )}
            {!query.isLoading && !query.isError && rows.map((row) => (
              <TableRow key={row.user_id}>
                <TableCell><UserCell row={row} /></TableCell>
                <TableCell><EmailCell email={row.email} /></TableCell>
                <TableCell className="text-sm">{formatDate(row.admin_granted_at)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.admin_granted_by_name ?? <span className="italic">system</span>}
                </TableCell>
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
