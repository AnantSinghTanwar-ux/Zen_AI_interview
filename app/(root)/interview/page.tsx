import Agent from "@/components/Agent";
import PageLayout from "@/components/PageLayout";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { redirect } from "next/navigation";

async function InterviewPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <>
      <PageLayout showFooter={false}>
        <div className="w-full">
          <Agent userName={user.name} userId={user.id} type="generate" />
        </div>
      </PageLayout>
    </>
  );
}

export default InterviewPage;
