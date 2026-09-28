import {
  FormSkeleton,
  HeaderSkeleton,
  PageSkeleton,
} from "@/components/admin/admin-skeletons";

export default function KontoLoading() {
  return (
    <PageSkeleton label="Laster konto …">
      <HeaderSkeleton />
      <FormSkeleton sections={1} />
    </PageSkeleton>
  );
}
