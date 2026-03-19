import { redirect } from "next/navigation";

type RedirectSearchParams = Record<string, string | string[] | undefined>;

function buildPublisherHref(searchParams: RedirectSearchParams) {
  const params = new URLSearchParams();
  params.set("intent", "builder");

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
  }

  const query = params.toString();
  return query ? `/queue-builder?${query}` : "/queue-builder";
}

export default function QueuePage({ searchParams = {} }: { searchParams?: RedirectSearchParams }) {
  redirect(buildPublisherHref(searchParams));
}
