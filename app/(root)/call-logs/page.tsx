import { getCurrentUser } from "@/lib/actions/auth.actions";
import { redirect } from "next/navigation";
import { CallLogs } from "@/components/CallLogs";

export default async function CallLogsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <CallLogs userId={user.id} />
    </div>
  );
}
