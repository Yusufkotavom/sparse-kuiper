"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

export default function AccountSettingsPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.replace("/login");
        return;
      }
      setEmail(user.email || "");
      const meta = user.user_metadata as Record<string, unknown> | null | undefined;
      const nameValue = meta && typeof meta.full_name === "string" ? meta.full_name : "";
      setFullName(nameValue);
      setLoading(false);
    };
    loadUser();
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      await supabase.auth.updateUser({
        data: {
          full_name: fullName,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOutAll = async () => {
    setSigningOut(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Account settings</h1>
          <p className="text-xs text-muted-foreground">
            Kelola identitas Supabase Auth untuk workspace ini.
          </p>
        </div>
      </div>

      <Card className="border-border bg-surface/70">
        <CardHeader>
          <CardTitle className="text-sm">Profile</CardTitle>
          <CardDescription className="text-xs">
            Nama ini akan dipakai di header dan komponen lain di dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled className="bg-muted/60 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50 bg-surface/60">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Sign out</CardTitle>
          <CardDescription className="text-xs">
            Keluar dari session saat ini di browser ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOutAll}
            disabled={signingOut}
            className="border-destructive/60 text-destructive hover:bg-destructive/10"
          >
            {signingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign out of this device
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
