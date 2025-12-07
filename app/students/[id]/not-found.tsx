import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="h-16 w-16 text-slate-400 dark:text-slate-500 mb-4" />
        <h1 className="text-ds-h1 font-bold text-slate-900 dark:text-slate-100 mb-2">
          Student Not Found
        </h1>
        <p className="text-ds-small text-slate-600 dark:text-slate-400 mb-6">
          The student you're looking for doesn't exist or you don't have permission to view it.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-ds-md bg-mint-500 text-white hover:bg-mint-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
