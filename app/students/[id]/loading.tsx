import { StudentDetailSkeleton } from '@/app/components/loading-skeletons/StudentDetailSkeleton';

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <StudentDetailSkeleton />
    </div>
  );
}
