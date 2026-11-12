// shadcn-style class joiner. The project has no clsx or tailwind-merge, and the
// components that use this never pass conflicting utilities, so joining is enough.
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
