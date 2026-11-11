import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton columns={[[200, 440], [300, 260]]} />;
}
