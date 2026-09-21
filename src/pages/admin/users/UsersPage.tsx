import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Seo } from "@/components/Seo";
import { AdminsTable } from "./AdminsTable";
import { HostsTable } from "./HostsTable";
import { UsersTable } from "./UsersTable";

export default function UsersPage() {
  return (
    <>
      <Seo title="Users · CheapStays Admin" description="User management." path="/admin/users" />
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Browse and search everyone on the platform by role.
        </p>
      </div>

      <Tabs defaultValue="admins">
        <TabsList className="mb-6">
          <TabsTrigger value="admins">Admins</TabsTrigger>
          <TabsTrigger value="hosts">Hosts</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="admins">
          <AdminsTable />
        </TabsContent>
        <TabsContent value="hosts">
          <HostsTable />
        </TabsContent>
        <TabsContent value="users">
          <UsersTable />
        </TabsContent>
      </Tabs>
    </>
  );
}
