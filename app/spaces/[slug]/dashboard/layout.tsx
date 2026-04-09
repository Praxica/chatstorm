import { redirect } from "next/navigation";
import { SpaceService } from "@/lib/services/SpaceService";
import { SpaceProvider } from "@/lib/contexts/SpaceContext";
import type { Space } from "@/lib/types/space";
import DashboardLayout from "@/app/(dashboard)/layout";
import { getAuthenticatedUserId } from "@/lib/utils/auth";

interface SpaceDashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function SpaceDashboardLayout({ children, params }: SpaceDashboardLayoutProps) {
  const { slug } = await params;

  try {
    // Use the existing auth service to get normalized internal user ID
    const userId = await getAuthenticatedUserId();

    // Get full space with role for context
    const spaceWithRole = await SpaceService.getSpaceBySlug(slug, userId);

    if (!spaceWithRole) {
      redirect(`/spaces/${slug}`);
    }

    // Verify user is an active member (SpaceService should handle this)
    if (!spaceWithRole.userRole) {
      redirect(`/spaces/${slug}`);
    }

    return (
      <SpaceProvider space={spaceWithRole as Space} userRole={spaceWithRole.userRole}>
        <DashboardLayout>
          {children}
        </DashboardLayout>
      </SpaceProvider>
    );
  } catch (error) {
    console.error('Error in SpaceDashboardLayout:', error);
    // If it's an auth error, redirect to sign-in with return URL
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      redirect(`/sign-in?return_url=/spaces/${slug}/dashboard`);
    }
    redirect(`/spaces/${slug}`);
  }
}