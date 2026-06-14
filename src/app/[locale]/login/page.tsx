"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { adminBasePath } from "@/components/admin/paths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = use(params);
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        toast.error("Feil e-post eller passord");
        return;
      }
      router.push(adminBasePath(locale));
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Image
            src="/brand/logo.png"
            alt="Islamskole Bærum"
            width={64}
            height={64}
            className="mb-2 rounded-md"
          />
          <CardTitle className="font-heading">Logg inn</CardTitle>
          <CardDescription>Adminpanel for Islamskole Bærum</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Passord</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Logg inn
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
