"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CategoryManagement from "./ticket-properties/category-management"
import PriorityManagement from "./ticket-properties/priority-management"
import StatusManagement from "./ticket-properties/status-management"
import FieldGroupManagement from "./ticket-properties/field-group-management"

export default function TicketPropertiesManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Ticket Properties Management</h2>
        <p className="text-sm text-muted-foreground">Manage categories, priorities, statuses and field groups</p>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="priorities">Priorities</TabsTrigger>
          <TabsTrigger value="statuses">Statuses</TabsTrigger>
          <TabsTrigger value="groups">Field Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-6">
          <CategoryManagement />
        </TabsContent>

        <TabsContent value="priorities" className="mt-6">
          <PriorityManagement />
        </TabsContent>

        <TabsContent value="statuses" className="mt-6">
          <StatusManagement />
        </TabsContent>

        <TabsContent value="groups" className="mt-6">
          <FieldGroupManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}
