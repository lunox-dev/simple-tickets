"use client"

import type React from "react"

import { useState, useEffect, Suspense } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Shield } from "lucide-react"

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"email" | "otp">("email")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()

  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  // Redirect authenticated users
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.push(callbackUrl)
    }
  }, [status, session, router, callbackUrl])

  // Show loading while checking authentication
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Don't render login form if user is authenticated
  if (status === "authenticated") {
    return null
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError("Please enter your email address")
      return
    }

    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch("/api/auth/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        setSuccess("OTP sent to your email address")
        setStep("otp")
      } else {
        const data = await response.json()
        setError(data.error || "Failed to send OTP")
        setSuccess("")
        return
      }
    } catch (error) {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp) {
      setError("Please enter the OTP code")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        otp,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid or expired code. Please try again.")
      } else if (result?.ok) {
        setSuccess("Login successful! Setting up your account...")

        // Check if user needs automatic team assignment
        try {
          const sessionResponse = await fetch("/api/auth/session")
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json()

            // Check if user has teams but no acting team set (actionUserTeamId is null or actingAs is null)
            if (
              sessionData?.user?.teams?.length > 0 &&
              (sessionData.user.actionUserTeamId === null || !sessionData.user.actingAs)
            ) {
              // Automatically set the first team as acting team
              const firstTeam = sessionData.user.teams[0]

              const teamChangeResponse = await fetch("/api/user/preference/acting-team/change", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  userTeamId: firstTeam.userTeamId,
                }),
              })

              if (teamChangeResponse.ok) {
                setSuccess("Login successful! Redirecting...")
                // Wait a bit more to ensure the session is updated
                await new Promise((resolve) => setTimeout(resolve, 500))
              } else {
                console.warn("Failed to set default acting team")
                // Still proceed with login even if team assignment fails
              }
            }
          }
        } catch (error) {
          console.warn("Failed to check/set default acting team:", error)
          // Don't block login if team assignment fails
        }

        // Add a small delay to ensure all operations complete
        await new Promise((resolve) => setTimeout(resolve, 200))
        router.push(callbackUrl)
      }
    } catch (error) {
      setError("Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToEmail = () => {
    setStep("email")
    setOtp("")
    setError("")
    setSuccess("")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {step === "email" ? "Sign In" : "Enter Verification Code"}
          </CardTitle>
          <CardDescription className="text-center">
            {step === "email"
              ? "Enter your email to receive a verification code"
              : `We've sent a 6-digit code to ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {step === "email" ? (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  "Send Verification Code"
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <div className="relative">
                  <Shield className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="pl-10 text-center text-lg tracking-widest"
                    maxLength={6}
                    required
                    disabled={isLoading}
                  />
                </div>
                <p className="text-sm text-gray-500">Code expires in 5 minutes</p>
              </div>

              <div className="space-y-2">
                <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-white text-gray-700"
                  onClick={handleBackToEmail}
                  disabled={isLoading}
                >
                  Back to Email
                </Button>
              </div>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-gray-600 hover:text-gray-800"
                  onClick={handleSendOTP}
                  disabled={isLoading}
                >
                  Didn't receive the code? Resend
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
