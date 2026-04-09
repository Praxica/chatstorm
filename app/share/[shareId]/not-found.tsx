import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ShareNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 p-4 text-center">
      <h1 className="text-2xl font-bold">Chat Not Found</h1>
      <p className="text-gray-600 max-w-md">
        This shared chat could not be found or has been made private by its owner.
      </p>
      <Button asChild>
        <Link href="/">
          Go Home
        </Link>
      </Button>
    </div>
  );
} 