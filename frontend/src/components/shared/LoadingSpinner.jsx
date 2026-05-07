import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ size = 20, className = '' }) {
  return (
    <Loader2
      size={size}
      strokeWidth={1.75}
      className={`animate-spin text-ocean-700 ${className}`}
    />
  );
}
