import { AppSidebar } from "@/components/app-sidebar";
import { requireUser } from "@/lib/supabase/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex flex-1">
      <AppSidebar email={user.email ?? ""} />
      <div className="flex flex-1 flex-col overflow-auto">{children}</div>
    </div>
  );
}
