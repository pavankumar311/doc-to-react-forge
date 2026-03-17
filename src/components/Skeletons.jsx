import GscipCard from "./GscipCard";
import { Skeleton } from "./ui/skeleton";

const gridArray = (length) => Array.from({ length });

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 max-w-sm">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3 w-32" />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {gridArray(4).map((_, idx) => (
          <GscipCard key={idx} compact>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-3 w-28" />
          </GscipCard>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <GscipCard>
          <Skeleton className="h-56 w-full" />
        </GscipCard>
        <GscipCard>
          <div className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        </GscipCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <GscipCard>
          <div className="space-y-3">
            {gridArray(4).map((_, idx) => (
              <Skeleton key={idx} className="h-6 w-full" />
            ))}
          </div>
        </GscipCard>
        <GscipCard>
          <div className="space-y-3">
            {gridArray(4).map((_, idx) => (
              <Skeleton key={idx} className="h-6 w-full" />
            ))}
          </div>
        </GscipCard>
      </div>
    </div>
  );
}

export function AuditSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-7 w-48" />
      <GscipCard>
        <div className="space-y-4">
          {gridArray(5).map((_, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </GscipCard>
    </div>
  );
}

export function BlockDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <GscipCard>
          <Skeleton className="h-36 w-full" />
        </GscipCard>
        <GscipCard>
          <Skeleton className="h-36 w-full" />
        </GscipCard>
      </div>

      <GscipCard title="Feature Breakdown (All 13 Features)">
        <div className="grid grid-cols-3 gap-6">
          {gridArray(3).map((_, sectionIdx) => (
            <div key={sectionIdx} className="space-y-3">
              {gridArray(4).map((__, rowIdx) => (
                <Skeleton key={rowIdx} className="h-4 w-full" />
              ))}
            </div>
          ))}
        </div>
      </GscipCard>

      <GscipCard title="SHAP Explanation — Why is this block high risk?">
        <div className="space-y-3">
          {gridArray(4).map((_, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </GscipCard>
    </div>
  );
}

export function FairnessSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-5 w-40" />
      </div>

      <GscipCard title="Prediction Error by District">
        <div className="space-y-3">
          {gridArray(4).map((_, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </GscipCard>

      <div className="grid grid-cols-2 gap-4">
        <GscipCard title="Error by Crime Type">
          <div className="space-y-3">
            {gridArray(4).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </GscipCard>
        <GscipCard title="Disparity Threshold Config">
          <div className="space-y-3">
            <Skeleton className="h-6 w-full" />
            {gridArray(3).map((_, idx) => (
              <Skeleton key={idx} className="h-4 w-full" />
            ))}
            <Skeleton className="h-12 w-full" />
          </div>
        </GscipCard>
      </div>
    </div>
  );
}

export function HeatmapSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="flex gap-4">
        <Skeleton className="flex-1 h-[440px]" />
        <div className="w-80 space-y-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  );
}

export function ModelsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-5 w-64" />
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {gridArray(4).map((_, idx) => (
          <GscipCard key={idx} compact>
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-3 w-32" />
          </GscipCard>
        ))}
      </div>

      <GscipCard title="RMSE History (All Versions)" className="mb-4">
        <Skeleton className="h-44 w-full" />
      </GscipCard>

      <div className="grid grid-cols-2 gap-4">
        <GscipCard title="Feature Importance (SHAP)">
          <Skeleton className="h-40 w-full" />
        </GscipCard>
        <GscipCard title="Prediction vs Actual">
          <Skeleton className="h-40 w-full" />
        </GscipCard>
      </div>
    </div>
  );
}

export function TrendsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <div className="flex gap-2">
          {gridArray(3).map((_, idx) => (
            <Skeleton key={idx} className="h-8 w-20" />
          ))}
        </div>
      </div>

      <GscipCard title="District Crime Trend">
        <Skeleton className="h-64 w-full" />
      </GscipCard>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <GscipCard title="Rolling 7D vs 30D">
          <Skeleton className="h-44 w-full" />
        </GscipCard>
        <GscipCard title="Spike Detection Timeline">
          <Skeleton className="h-44 w-full" />
        </GscipCard>
      </div>

      <GscipCard title="Crime Type Breakdown (Last 30 Days)">
        <Skeleton className="h-48 w-full" />
        <div className="flex gap-3 mt-3">
          <Skeleton className="h-8 w-32" />
        </div>
      </GscipCard>
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="flex gap-6">
        <div className="w-56 space-y-4 shrink-0">
          <GscipCard title="Report Type">
            <div className="space-y-2">
              {gridArray(5).map((_, idx) => (
                <Skeleton key={idx} className="h-3 w-full" />
              ))}
            </div>
          </GscipCard>

          <GscipCard title="Parameters">
            <div className="space-y-3">
              {gridArray(3).map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full" />
              ))}
              <Skeleton className="h-9 w-full" />
            </div>
          </GscipCard>
        </div>

        <div className="flex-1 space-y-3">
          {gridArray(3).map((_, idx) => (
            <GscipCard key={idx}>
              <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </GscipCard>
          ))}
        </div>
      </div>
    </div>
  );
}
