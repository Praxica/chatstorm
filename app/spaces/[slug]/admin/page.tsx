import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

interface SpaceDashboardProps {
  params: Promise<{ slug: string }>;
}

export default async function SpaceAdminDashboard({ params }: SpaceDashboardProps) {
  const authResult = await auth();
  const userId = authResult.userId;
  
  if (!userId) {
    redirect('/sign-in');
  }

  const { slug } = await params;
  
  // Redirect to the members tab by default
  redirect(`/spaces/${slug}/admin/members`);
}