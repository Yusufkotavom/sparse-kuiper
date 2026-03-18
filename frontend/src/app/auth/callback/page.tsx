"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const completeAuth = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) {
        router.replace("/login")
        return
      }
      const { data } = await supabase.auth.getSession()
      router.replace(data.session ? "/dashboard" : "/login")
    }

    completeAuth()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Menyelesaikan login...</p>
    </div>
  )
}
