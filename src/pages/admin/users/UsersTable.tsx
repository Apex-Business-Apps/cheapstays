import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminUsers } from "./useAdminUsers";
import { UsersToolbar } from "./UsersToolbar";
import { Pagination } from "./Pagination";
import {
  EmailCell, EmptyRow, ErrorRow, RoleBadges, SortableHead, TableSkeletonRows,
  UserCell, formatRelative,
} from "./shared";
import { DEFAULT_SCOPE_STATE, type ScopeState, type SortColumn } from "./types";

const COLS = 5;

export function UsersTable() {
  const [state, setState] = useState<ScopeState>(DEFAULT_SCOPE_STATE);
  const patch = (p: Partial<ScopeState>) => setState((s) => ({ ...s, ...p }));

  const query = useAdminUsers("user", state);
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
        scope="user"
        state={state}
        onChange={patch}
        totalLabel={query.isLoading ? "Loading…" : `${total} ${total === 1 ? "user" : "users"}`}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="User"
                column="display_name"
                activeColumn={state.sortColumn}
                direction={state.sortDirection}
                onSort={onSort}
              />
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground">Email</TableHead>
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground">Roles</TableHead>
              <SortableHead
                label="Joined"
                column="joined_at"
                activeColumn={state.sortColumn}
                direction={state.sortDirection}
                onSort={onSort}
              />
              <SortableHead
                label="Last sign in"
                column="last_sign_in_at"
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
              <EmptyRow cols={COLS} label="No users match these filters." />
            )}
            {!query.isLoading && !query.isError && rows.map((row) => (
              <TableRow key={row.user_id}>
                <TableCell><UserCell row={row} /></TableCell>
                <TableCell><EmailCell email={row.email} /></TableCell>
                <TableCell><RoleBadges roles={row.roles} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatRelative(row.joined_at)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatRelative(row.last_sign_in_at)}</TableCell>
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
