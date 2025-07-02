"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, User, Bell, CheckCircle, AlertCircle } from "lucide-react"
import NotificationRuleBuilder from "@/components/user/profile/NotificationRuleBuilder"

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const [emailRules, setEmailRules] = useState<any[]>([])
  const [smsRules, setSmsRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    if (status !== "authenticated") {
      if (status !== "loading") {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    fetch("/api/user/account")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch account data")
        return res.json()
      })
      .then((data) => {
        setEmailRules(data.emailNotificationPreferences?.rules || [])
        setSmsRules(data.smsNotificationPreferences?.rules || [])
      })
      .catch((error) => {
        setMessage({ type: "error", text: error.message || "Failed to load user account" })
      })
      .finally(() => setLoading(false))
  }, [status])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch("/api/user/preference/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: { rules: emailRules },
          sms: { rules: smsRules },
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: "success", text: "Notification preferences saved successfully!" })
      } else {
        const errorDetails = data.details ? `: ${data.details.join(", ")}` : ""
        setMessage({ type: "error", text: `${data.error || "Failed to save preferences"}${errorDetails}` })
      }
    } catch (error) {
      setMessage({ type: "error", text: "An unexpected error occurred while saving." })
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          <span>Loading profile...</span>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>You must be signed in to view your profile.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account information and notification preferences</p>
      </div>

      {message && (
        <Alert
          variant={message.type === "success" ? "default" : "destructive"}
          className={`mb-6 ${message.type === "success" ? "border-green-200 bg-green-50 text-green-800" : ""}`}
        >
          {message.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Account Information
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Your basic account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                  <p className="text-lg font-medium">{session?.user?.name || "Not set"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                  <p className="text-lg">{session?.user?.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User ID</label>
                  <p className="text-lg font-mono">{(session?.user as any)?.id}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Email Notifications
                </CardTitle>
                <CardDescription>Configure when you receive email notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationRuleBuilder value={emailRules} onChange={setEmailRules} loading={saving} type="email" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  SMS Notifications
                </CardTitle>
                <CardDescription>Configure when you receive SMS notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationRuleBuilder value={smsRules} onChange={setSmsRules} loading={saving} type="sms" />
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end pt-6">
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Notification Preferences"
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
