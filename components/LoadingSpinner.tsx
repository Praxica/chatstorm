interface LoadingSpinnerProps {
  variant?: 'fullscreen' | 'overlay' | 'inline';
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

export function LoadingSpinner({ 
  variant = 'fullscreen', 
  size = 'medium',
  message
}: LoadingSpinnerProps) {
  // Size mappings
  const sizeClasses = {
    small: 'h-4 w-4 border-2',
    medium: 'h-8 w-8 border-b-2',
    large: 'h-12 w-12 border-b-2'
  };
  
  // Fullscreen loading (original behavior)
  if (variant === 'fullscreen') {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className={`animate-spin rounded-full border-gray-900 ${sizeClasses[size]}`}></div>
        {message && <p className="mt-2 text-gray-600">{message}</p>}
      </div>
    );
  }
  
  // Overlay loading - preserves layout with a semi-transparent overlay
  if (variant === 'overlay') {
    return (
      <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center z-10">
        <div className={`animate-spin rounded-full border-gray-900 ${sizeClasses[size]}`}></div>
        {message && <p className="mt-2 text-gray-600">{message}</p>}
      </div>
    );
  }
  
  // Inline loading - just the spinner to be used within existing layouts
  return (
    <div className="flex items-center justify-center py-2">
      <div className={`animate-spin rounded-full border-gray-900 ${sizeClasses[size]}`}></div>
      {message && <p className="ml-2 text-gray-600">{message}</p>}
    </div>
  );
} 