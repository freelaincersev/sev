import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Sev
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome to Sev</CardTitle>
            <CardDescription>
              Your user-owned AI memory layer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
