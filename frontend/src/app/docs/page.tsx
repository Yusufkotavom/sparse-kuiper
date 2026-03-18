import fs from "fs";
import path from "path";
import Link from "next/link";
import { PageHeader } from "@/components/atoms/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default async function DocsPage() {
  const primaryDir = path.join(process.cwd(), "docs"); // frontend/docs
  const fallbackDir = path.resolve(process.cwd(), "..", "docs"); // root/docs
  let entriesPrimary: string[] = [];
  let entriesFallback: string[] = [];
  try {
    entriesPrimary = await fs.promises.readdir(primaryDir);
  } catch {
    entriesPrimary = [];
  }
  try {
    entriesFallback = await fs.promises.readdir(fallbackDir);
  } catch {
    entriesFallback = [];
  }
  const files = Array.from(
    new Set(
      [...entriesPrimary, ...entriesFallback].filter((name) => name.endsWith(".md") || name.endsWith(".mdx"))
    )
  ).sort();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader title="Documentation" description="Browse project docs (Markdown/MDX) stored in /docs" />
      <div className="grid grid-cols-1 gap-4">
        {files.length === 0 && (
          <Card className="bg-surface border-border">
            <CardContent className="text-sm text-muted-foreground p-4">No docs found in /docs</CardContent>
          </Card>
        )}
        {files.map((name) => {
          const slug = name.replace(/\.(md|mdx)$/i, "");
          return (
            <Card key={name} className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm">{name}</CardTitle>
                <CardDescription className="text-xs">/docs/{name}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <Link className="text-primary underline" href={`/docs/${encodeURIComponent(slug)}`}>
                  Open
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
