export interface TicketListItem {
    id: number
    title: string
    body: string
    currentStatusId: number
    currentPriorityId: number
    currentAssignedTo: {
      entityId: number
      name: string
    } | null
    createdBy: {
      entityId: number
      name: string
    }
    createdAt: string
    updatedAt: string
    unread: boolean
  }
  
  export interface Priority {
    id: number
    name: string
    color: string
  }
  
  export interface Status {
    id: number
    name: string
    color: string
  }
  
  export interface Category {
    id: number
    name: string
    children: Category[]
  }
  
  export interface FlatCategory {
    id: number
    name: string
    fullPath: string
    level: number
  }
  
  export interface Entity {
    entityId: string
    type: "team" | "user"
    name: string
    children?: Entity[]
  }
  
  export interface FlatEntity {
    entityId: string
    name: string
    type: "team" | "user"
    fullPath: string
    level: number
  }
  
  export interface PaginationInfo {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    itemsOnPage: number
    startIndex: number
    endIndex: number
  }
  
  export interface FilterState {
    search: string
    statuses: number[]
    priorities: number[]
    categories: number[]
    assignedEntities: number[]
    createdByEntities: number[]
    fromDate: Date | null
    toDate: Date | null
    includeUserTeamsForTeams: boolean
    includeUserTeamsForCreatedByTeams: boolean
  }
  