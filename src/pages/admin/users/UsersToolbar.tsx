import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import type { HostVerification, MemberFilter, RoleScope, ScopeState } from "./types";

type Props = {
  scope: RoleScope;
  state: ScopeState;
  onChange: (patch: Partial<ScopeState>) => void;
  totalLabel: string;
};

export function UsersToolbar({ scope, state, onChange, totalLabel }: Props) {
  // Debounced local search input.
  const [localSearch, setLocalSearch] = useState(state.search);
  useEffect(() => { setLocalSearch(state.search); }, [state.search]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== state.search) onChange({ search: localSearch, page: 1 });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-1">
        <div className="relative md:max-w-xs md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search name or email"
            className="h-9 pl-9 text-sm"
          />
        </div>

        {scope === "host" && (
          <Select
            value={state.hostVerification}
            onValueChange={(v) => onChange({ hostVerification: v as HostVerification, page: 1 })}
          >
            <SelectTrigger className="h-9 w-full md:w-48 text-sm">
              <SelectValue placeholder="Verification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All verifications</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="unverified">Unverified</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        )}

        {scope === "user" && (
          <Select
            value={state.memberFilter}
            onValueChange={(v) => onChange({ memberFilter: v as MemberFilter, page: 1 })}
          >
            <SelectTrigger className="h-9 w-full md:w-48 text-sm">
              <SelectValue placeholder="Membership" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              <SelectItem value="members">Paid members</SelectItem>
              <SelectItem value="plain">Plain users</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{totalLabel}</span>
        <Select
          value={String(state.pageSize)}
          onValueChange={(v) => onChange({ pageSize: Number(v) as 25 | 50 | 100, page: 1 })}
        >
          <SelectTrigger className="h-9 w-[110px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
