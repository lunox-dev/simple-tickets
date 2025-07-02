import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Profile Settings",
  description: "Manage your account information and notification preferences",
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <a href="/" className="hover:text-foreground">
              Home
            </a>
            <span>/</span>
            <span className="text-foreground">Profile</span>
          </nav>
        </div>
      </div>
      {children}
    </div>
  )
}
