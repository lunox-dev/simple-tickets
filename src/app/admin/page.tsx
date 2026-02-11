import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import UserManagement from "@/components/admin/user-management"
import TeamManagement from "@/components/admin/team-management"
import UserTeamAssignment from "@/components/admin/user-team-assignment"
import TicketPropertiesManagement from "@/components/admin/ticket-properties-management"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions"
import { redirect } from "next/navigation"

export default async function AdminPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/admin")
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Admin Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger value="teams">Team Management</TabsTrigger>
              <TabsTrigger value="assignments">User-Team Assignments</TabsTrigger>
              <TabsTrigger value="properties">Ticket Properties</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="mt-6">
              <UserManagement />
            </TabsContent>

            <TabsContent value="teams" className="mt-6">
              <TeamManagement />
            </TabsContent>

            <TabsContent value="assignments" className="mt-6">
              <UserTeamAssignment />
            </TabsContent>

            <TabsContent value="properties" className="mt-6">
              <TicketPropertiesManagement />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
