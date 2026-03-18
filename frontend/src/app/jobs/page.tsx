import { redirect } from "next/navigation";

type RedirectSearchParams = Record<string, string | string[] | undefined>;

type JobsPageProps = {
  searchParams?: Promise<RedirectSearchParams>;
};

function buildRunsHref(searchParams: RedirectSearchParams) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
  }

  params.set("tab", "scheduled");
  params.set("intent", "jobs");

  return `/runs?${params.toString()}`;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  redirect(buildRunsHref(resolvedSearchParams));
}
