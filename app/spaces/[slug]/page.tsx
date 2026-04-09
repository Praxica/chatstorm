import { getAuthenticatedUserId } from "@/lib/utils/auth";
import SpaceJoinPage from "@/components/spaces/SpaceJoinPage";
import ClientRedirect from "@/components/ClientRedirect";
import { prisma } from "@/lib/prisma";

interface SpacePageProps {
  params: Promise<{ slug: string }>;
}

export default async function SpacePage({ params }: SpacePageProps) {
  try {
    // Resolve internal user ID via shared auth utility
    let internalUserId: string;
    try {
      internalUserId = await getAuthenticatedUserId();
    } catch {
      const { slug } = await params;
      return <ClientRedirect to={`/sign-in?return_url=/spaces/${slug}`} reason="User not authenticated" />;
    }

  const { slug } = await params;
  
  // Get space details (public info for join page)
  const space = await prisma.spaces.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      signupMode: true,
      allowedEmailDomain: true,
      autoInstallTemplates: true,
      joinInstructions: true,
    },
  });

  if (!space) {
    return <ClientRedirect to="/dashboard" reason="Space not found" />;
  }

  // Fetch DB user by internal ID for email (client-side domain check)
  const user = await prisma.user.findUnique({
    where: { id: internalUserId },
    select: { id: true, email: true }
  });
  
  if (!user) {
    // If somehow no DB user, treat as unauthenticated and show join page without email
    return <SpaceJoinPage space={space} userRole={undefined} membershipStatus={undefined} userEmail={undefined} />;
  }
  
  // Check if user is already a member using the internal user ID
  const membership = await prisma.spaceMembers.findFirst({
    where: {
      spaceId: space.id,
      userId: user.id,
    },
    select: {
      id: true,
      role: true,
      status: true,
      userId: true,
      spaceId: true,
    }
  }).catch((error) => {
    console.error('Error fetching membership:', error);
    return null;
  });

  // If user is a member with active status, redirect to appropriate dashboard
  if (membership && membership.status === 'active') {
    const redirectPath = (membership.role === 'owner' || membership.role === 'admin') 
      ? `/spaces/${slug}/admin` 
      : `/spaces/${slug}/dashboard`;
    return <ClientRedirect to={redirectPath} reason="User has active membership" />;
  }

  // Show join page for non-members or pending members
    return <SpaceJoinPage space={space} userRole={membership?.role} membershipStatus={membership?.status} userEmail={user.email || undefined} />;
  } catch (error) {
    console.error('Error in SpacePage:', error);
    
    // If it's an authentication error, try to redirect to sign-in
    const { slug } = await params;
    return <ClientRedirect to={`/sign-in?return_url=/spaces/${slug}`} reason="Error in SpacePage" />;
  }
}