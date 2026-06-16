import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="grid gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
