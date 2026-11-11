import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton columns={[[180, 360], [260, 280]]} />;
}
