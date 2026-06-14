import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getEmail() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? "-";
  } catch {
    return "-";
  }
}

export default async function KontoPage() {
  const email = await getEmail();

  return (
    <div>
      <PageHeader title="Min konto" description="Innstillinger for din konto." />

      <div className="grid max-w-xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Innlogget som</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endre passord</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
