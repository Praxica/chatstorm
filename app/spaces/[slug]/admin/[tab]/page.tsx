import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SpaceService } from "@/lib/services/SpaceService";
import SpaceOwnerDashboard from "@/components/spaces/SpaceOwnerDashboard";

interface SpaceDashboardTabProps {
  params: Promise<{ slug: string; tab: string }>;
}

export default async function SpaceDashboardTab({ params }: SpaceDashboardTabProps) {
  const authResult = await auth();
  const userId = authResult.userId;
  
  if (!userId) {
    redirect('/sign-in');
  }

  const { slug, tab } = await params;
  const space = await SpaceService.getSpaceBySlug(slug, userId);

  if (!space) {
    redirect('/dashboard');
  }

  // Check if user is owner or admin
  if (space.userRole !== 'owner' && space.userRole !== 'admin') {
    redirect(`/spaces/${slug}`);
  }

  // Validate tab name
  const validTabs = ['members', 'templates', 'models', 'token-plans', 'settings'];
  if (!validTabs.includes(tab)) {
    redirect(`/spaces/${slug}/admin/members`);
  }

  return <SpaceOwnerDashboard space={space} defaultTab={tab} />;
}