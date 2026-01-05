# Complete Permission System Guide

## Table of Contents
1. [Overview](#overview)
2. [Permission Structure](#permission-structure)
3. [Permission Levels](#permission-levels)
4. [Ticket Permissions](#ticket-permissions)
5. [User & Team Management Permissions](#user--team-management-permissions)
6. [Entity & API Key Permissions](#entity--api-key-permissions)
7. [Permission Scopes](#permission-scopes)
8. [Common Permission Patterns](#common-permission-patterns)
9. [Examples](#examples)
10. [Troubleshooting](#troubleshooting)

## Overview

The Simple Tickets system uses a hierarchical permission system with three levels:
- **User Permissions**: Individual user permissions
- **Team Permissions**: Permissions granted to all members of a team
- **UserTeam Permissions**: Permissions specific to a user's membership in a particular team

Permissions are stored as strings in arrays and follow a specific format: `resource:action:scope:context`

## Permission Structure

### Basic Format
```
resource:action:scope:context
```

### Extended Format (for complex permissions)
```
resource:action:action_type:from:value:to:value:context:scope
```

## Permission Levels

### 1. User Permissions
- Stored in `User.permissions` array
- Apply to the user regardless of team membership
- Examples: `user:account:modify`, `team:create`

### 2. Team Permissions
- Stored in `Team.permissions` array
- Apply to all members of that team
- Examples: `ticket:create`, `ticket:read:assigned:any`

### 3. UserTeam Permissions
- Stored in `UserTeam.permissions` array
- Apply only when user is acting as that specific UserTeam
- Examples: `userteam:manage:permission`, `ticket:action:change:status:any`

## Ticket Permissions

### Reading Tickets

#### Basic Read Permissions
- `ticket:read:assigned:any` - Can read any ticket assigned to anyone
- `ticket:read:assigned:team:any` - Can read tickets assigned to their team
- `ticket:read:assigned:team:unclaimed` - Can read unclaimed tickets in their team
- `ticket:read:assigned:self` - Can only read tickets assigned to themselves

- `ticket:read:createdby:any` - Can read any ticket created by anyone
- `ticket:read:createdby:team:any` - Can read tickets created by their team
- `ticket:read:createdby:self` - Can only read tickets they created

#### Examples
```json
{
  "permissions": [
    "ticket:read:assigned:any",
    "ticket:read:createdby:team:any"
  ]
}
```

### Creating Tickets
- `ticket:create` - Can create new tickets

### Ticket Actions

#### Status Changes
```
ticket:action:change:status:from:any:to:any:assigned:any
```

**Format Breakdown:**
- `ticket:action:change:status` - Action type
- `from:any` - Can change from any status (or specific status ID)
- `to:any` - Can change to any status (or specific status ID)
- `assigned:any` - Context and scope

**Examples:**
- `ticket:action:change:status:from:any:to:any:assigned:any` - Can change any ticket's status
- `ticket:action:change:status:from:1:to:2:assigned:self` - Can only change status from 1 to 2 on tickets assigned to self
- `ticket:action:change:status:from:any:to:any:createdby:team` - Can change status on tickets created by their team

#### Priority Changes
```
ticket:action:change:priority:from:any:to:any:assigned:any
```

**Examples:**
- `ticket:action:change:priority:from:any:to:any:assigned:any` - Can change any ticket's priority
- `ticket:action:change:priority:from:1:to:3:assigned:self` - Can only change priority from 1 to 3 on self-assigned tickets

#### Category Changes
```
ticket:action:change:category:from:any:to:any:assigned:any
```

**Examples:**
- `ticket:action:change:category:from:any:to:any:assigned:any` - Can change any ticket's category
- `ticket:action:change:category:from:5:to:any:createdby:team` - Can change category from 5 to any on team-created tickets

#### Assignment Changes
```
ticket:action:change:assigned:from:any:to:any:assigned:any
```

**Examples:**
- `ticket:action:change:assigned:from:any:to:any:assigned:any` - Can reassign any ticket to anyone
- `ticket:action:change:assigned:from:any:to:any:assigned:self` - Can only reassign tickets assigned to self

#### Claiming Tickets
```
ticket:action:claim:any
```

**Examples:**
- `ticket:action:claim:any` - Can claim any unassigned ticket
- `ticket:action:claim:team:unclaimed` - Can only claim unclaimed tickets in their team
- `ticket:action:claim:self` - Can only claim tickets for themselves

#### Creating Threads
```
ticket:action:thread:create:any
```

**Examples:**
- `ticket:action:thread:create:any` - Can create threads on any ticket
- `ticket:action:thread:create:assigned` - Can create threads on tickets assigned to them
- `ticket:action:thread:create:team:unclaimed` - Can create threads on unclaimed team tickets

#### Access Visibility
```
ticket:action:view_access
```

**Examples:**
- `ticket:action:view_access` - Can view the list of users who have access to the ticket

## User & Team Management Permissions

### User Management
- `user:account:create` - Can create new user accounts
- `user:account:modify` - Can modify user accounts
- `user:account:list` - Can list all users

### Team Management
- `team:create` - Can create new teams
- `team:modify` - Can modify team settings
- `team:list` - Can list all teams

### UserTeam Management
- `userteam:assign:own` - Can assign themselves to teams
- `userteam:assign:any` - Can assign any user to any team (Global assignment permission)
- `userteam:manage:permission` - Can manage UserTeam permissions
- `userteam:manage:priority` - Can manage UserTeam display priority

## Entity & API Key Permissions

### Entity Access
- `entity:list:any` - Can list all entities (teams and users)
- `entity:list:team:any` - Can list all teams (excludes users)
- `entity:list:own` - Can only list entities they have access to

### Ticket Properties Management
- `ticket:properties:manage` - Can manage ticket properties (status, priority, category)

### View Permissions
- `ticketstatus:view:any` - Can view all ticket statuses
- `ticketpriority:view:any` - Can view all ticket priorities
- `ticketcategory:view:any` - Can view all ticket categories
- `ticketcategory:view:own` - Can only view categories available to their team

## Permission Scopes

### Scope Types

#### `any`
- Most permissive scope
- Allows action on any resource regardless of ownership or assignment
- Example: `ticket:read:assigned:any`

#### `team`
- Allows action on resources within the user's team
- Example: `ticket:read:assigned:team:any`

#### `team:unclaimed`
- Allows action on unclaimed resources within the user's team
- Example: `ticket:read:assigned:team:unclaimed`

#### `self`
- Most restrictive scope
- Allows action only on resources owned by or assigned to the user
- Example: `ticket:read:assigned:self`

### Context Types

#### `assigned`
- Permission applies based on who the ticket is assigned to
- Example: `ticket:action:change:status:from:any:to:any:assigned:any`

#### `createdby`
- Permission applies based on who created the ticket
- Example: `ticket:action:change:status:from:any:to:any:createdby:any`

## Common Permission Patterns

### 1. Full Access User
```json
{
  "permissions": [
    "user:account:list",
    "user:account:modify",
    "team:create",
    "team:modify",
    "team:list",
    "ticket:create",
    "ticket:read:assigned:any",
    "ticket:read:createdby:any",
    "ticket:action:change:status:from:any:to:any:assigned:any",
    "ticket:action:change:priority:from:any:to:any:assigned:any",
    "ticket:action:change:category:from:any:to:any:assigned:any",
    "ticket:action:change:assigned:from:any:to:any:assigned:any",
    "ticket:action:thread:create:any",
    "ticket:properties:manage"
  ]
}
```

### 2. Team Member (Limited Access)
```json
{
  "permissions": [
    "ticket:create",
    "ticket:read:assigned:team:any",
    "ticket:read:createdby:self",
    "ticket:action:change:status:from:any:to:any:assigned:self",
    "ticket:action:thread:create:assigned"
  ]
}
```

### 3. Team Lead
```json
{
  "permissions": [
    "ticket:create",
    "ticket:read:assigned:team:any",
    "ticket:read:createdby:team:any",
    "ticket:action:change:status:from:any:to:any:assigned:team",
    "ticket:action:change:priority:from:any:to:any:assigned:team",
    "ticket:action:change:assigned:from:any:to:any:assigned:team",
    "ticket:action:thread:create:any",
    "userteam:manage:permission"
  ]
}
```

### 4. Support Agent
```json
{
  "permissions": [
    "ticket:create",
    "ticket:read:assigned:any",
    "ticket:read:createdby:any",
    "ticket:action:change:status:from:any:to:any:assigned:any",
    "ticket:action:change:priority:from:any:to:any:assigned:any",
    "ticket:action:change:category:from:any:to:any:assigned:any",
    "ticket:action:change:assigned:from:any:to:any:assigned:any",
    "ticket:action:thread:create:any",
    "ticket:action:claim:any"
  ]
}
```

## Examples

### Example 1: Setting Up a Development Team

**Team Permissions:**
```json
{
  "name": "Development Team",
  "permissions": [
    "ticket:create",
    "ticket:read:assigned:team:any",
    "ticket:read:createdby:team:any",
    "ticket:action:change:status:from:any:to:any:assigned:team",
    "ticket:action:change:priority:from:any:to:any:assigned:team",
    "ticket:action:change:category:from:any:to:any:assigned:team",
    "ticket:action:thread:create:any",
    "ticketcategory:view:any"
  ]
}
```

**Team Lead UserTeam Permissions:**
```json
{
  "permissions": [
    "userteam:manage:permission",
    "userteam:manage:priority",
    "ticket:action:change:assigned:from:any:to:any:assigned:team"
  ]
}
```

### Example 2: Setting Up a Customer Support Team

**Team Permissions:**
```json
{
  "name": "Customer Support",
  "permissions": [
    "ticket:create",
    "ticket:read:assigned:any",
    "ticket:read:createdby:any",
    "ticket:action:change:status:from:any:to:any:assigned:any",
    "ticket:action:change:priority:from:any:to:any:assigned:any",
    "ticket:action:change:category:from:any:to:any:assigned:any",
    "ticket:action:change:assigned:from:any:to:any:assigned:any",
    "ticket:action:thread:create:any",
    "ticket:action:claim:any"
  ]
}
```

### Example 3: Setting Up an Admin User

**User Permissions:**
```json
{
  "permissions": [
    "user:account:create",
    "user:account:modify",
    "user:account:list",
    "team:create",
    "team:modify",
    "team:list",
    "ticket:properties:manage",
    "ticketstatus:view:any",
    "ticketpriority:view:any",
    "ticketcategory:view:any",
    "ticketcategory:create"
  ]
}
```

## Permission Inheritance

### How Permissions Are Combined

1. **User Permissions** are always available
2. **Team Permissions** are available when user is a member of that team
3. **UserTeam Permissions** are available when user is acting as that specific UserTeam

### Permission Resolution Order

1. Check User permissions
2. Check Team permissions (from all teams user belongs to)
3. Check UserTeam permissions (from the currently active UserTeam)

### Example Session Structure
```json
{
  "user": {
    "id": 1,
    "permissions": ["user:account:list", "team:create"],
    "teams": [
      {
        "userTeamId": 1,
        "teamId": 1,
        "permissions": ["ticket:create", "ticket:read:assigned:any"],
        "userTeamPermissions": ["userteam:manage:permission"]
      }
    ],
    "actionUserTeamId": 1,
    "actingAs": {
      "userTeamId": 1,
      "userTeamEntityId": 2,
      "teamName": "Development Team"
    }
  }
}
```

## Troubleshooting

### Common Permission Issues

#### 1. "Forbidden" Error on Ticket Actions
**Problem:** User can't change ticket status/priority/category/assignment

**Solution:** Check if user has the correct action permission:
```json
{
  "permissions": [
    "ticket:action:change:status:from:any:to:any:assigned:any"
  ]
}
```

#### 2. Can't See Tickets
**Problem:** User can't see any tickets in the list

**Solution:** Check if user has read permissions:
```json
{
  "permissions": [
    "ticket:read:assigned:any",
    "ticket:read:createdby:any"
  ]
}
```

#### 3. Can't Create Threads
**Problem:** User can't add comments to tickets

**Solution:** Check if user has thread creation permission:
```json
{
  "permissions": [
    "ticket:action:thread:create:any"
  ]
}
```

#### 4. Can't Access Admin Panel
**Problem:** User can't access admin functions

**Solution:** Check if user has admin permissions:
```json
{
  "permissions": [
    "user:account:list",
    "team:list",
    "ticket:properties:manage"
  ]
}
```

### Debugging Permission Issues

#### 1. Check Session Data
Look at the user's session to see what permissions they have:
```javascript
console.log(session.user.permissions)
console.log(session.user.teams)
```

#### 2. Check Permission Format
Ensure permissions follow the correct format:
- ✅ `ticket:action:change:status:from:any:to:any:assigned:any`
- ❌ `ticket:action:change:status:any:any:assigned:any`

#### 3. Check Scope and Context
Make sure the scope and context match the action:
- For assigned tickets: use `assigned:scope`
- For created tickets: use `createdby:scope`

### Best Practices

#### 1. Start with Minimal Permissions
Always start with the most restrictive permissions and gradually increase access as needed.

#### 2. Use Team Permissions for Common Access
Put common permissions at the team level rather than individual user level.

#### 3. Use UserTeam Permissions for Role-Specific Access
Use UserTeam permissions for actions that should only be available when acting as that specific team member.

#### 4. Test Permission Changes
Always test permission changes in a development environment before applying to production.

#### 5. Document Permission Changes
Keep a record of permission changes and their rationale for future reference.

## API Key Permissions

API keys can have the same permissions as users and are used for programmatic access.

### Example API Key Setup
```json
{
  "key": "api_key_123",
  "label": "Integration API Key",
  "permissions": [
    "ticket:create",
    "ticket:read:assigned:any",
    "ticket:action:change:status:from:any:to:any:assigned:any"
  ]
}
```

### Using API Keys
API keys are passed in the `x-api-key` header:
```bash
curl -H "x-api-key: api_key_123" \
     -H "Content-Type: application/json" \
     -d '{"title":"Test","body":"Test body"}' \
     http://localhost:3000/api/ticket/create
```

## Migration and Updates

### Adding New Permissions
When adding new features, consider:
1. What permissions are needed
2. How they fit into the existing permission structure
3. Whether they should be user, team, or UserTeam level
4. What the default permissions should be

### Updating Existing Permissions
When updating permissions:
1. Test the changes thoroughly
2. Update documentation
3. Notify users of changes
4. Provide migration scripts if needed

## Conclusion

The permission system in Simple Tickets is designed to be flexible and secure. By understanding the structure and following the patterns outlined in this guide, you can effectively manage access control for your ticket system.

Remember:
- Start with minimal permissions
- Use the appropriate permission level (user/team/UserTeam)
- Test thoroughly before applying changes
- Document your permission structure
- Regular review and audit of permissions
