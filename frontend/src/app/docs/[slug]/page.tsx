import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/atoms/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mdToHtml(md: string): string {
  // Block-level parsing
  const lines = md.split(/\r?\n/);
  let i = 0;
  const parts: string[] = [];
  const push = (s: string) => parts.push(s);
  const h = (tag: string, cls: string, text: string) => `<${tag} class="${cls}">${text}</${tag}>`;
  const hr = () => `<hr class="border-border my-4" />`;
  const ulWrap = (items: string[]) => `<ul class="list-disc pl-5 space-y-1">${items.join("")}</ul>`;
  const tableWrap = (headers: string[], rows: string[][]) => {
    return `<div class="overflow-x-auto border border-border rounded-lg"><table class="w-full text-sm">
      <thead class="bg-background border-b border-border">${headers
        .map((hcell) => `<th class="text-left px-3 py-2 font-semibold">${hcell.trim()}</th>`)
        .join("")}</thead>
      <tbody>${rows
        .map(
          (row) =>
            `<tr class="border-b last:border-b-0 border-border/60">${row
              .map((cell) => `<td class="px-3 py-2 align-top">${cell.trim()}</td>`)
              .join("")}</tr>`
        )
        .join("")}</tbody>
    </table></div>`;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (/^\s*```/.test(line)) {
      const fence = line.match(/^\s*```(\w+)?/)?.[1] || "";
      i++;
      const buf: string[] = [];
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      // consume closing ```
      if (i < lines.length) i++;
      const code = escapeHtml(buf.join("\n"));
      push(
        `<pre class="rounded-lg border border-border bg-zinc-950 text-zinc-100 p-3 overflow-x-auto"><code class="language-${fence}">${code}</code></pre>`
      );
      continue;
    }

    // Horizontal rule
    if (/^---\s*$/.test(line)) {
      push(hr());
      i++;
      continue;
    }

    // Table block: start with a pipe
    if (/^\|/.test(line)) {
      const tbl: string[] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        tbl.push(lines[i]);
        i++;
      }
      if (tbl.length >= 2 && /\|\s*-+\s*\|/.test(tbl[1])) {
        const headerCells = tbl[0].split("|").slice(1, -1);
        const rowLines = tbl.slice(2);
        const rows = rowLines.map((r) => r.split("|").slice(1, -1));
        push(tableWrap(headerCells, rows));
        continue;
      } else {
        // Not a proper table, render as pre
        push(h("pre", "text-xs text-muted-foreground", escapeHtml(tbl.join("\n"))));
        continue;
      }
    }

    // List block
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*-\s+/, ""))}</li>`);
        i++;
      }
      push(ulWrap(items));
      continue;
    }

    // Headings
    if (/^###\s+/.test(line)) {
      push(h("h3", "text-base md:text-lg font-semibold tracking-tight", inline(line.replace(/^###\s+/, ""))));
      i++;
      continue;
    }
    if (/^##\s+/.test(line)) {
      push(h("h2", "text-lg md:text-xl font-bold tracking-tight", inline(line.replace(/^##\s+/, ""))));
      i++;
      continue;
    }
    if (/^#\s+/.test(line)) {
      push(h("h1", "text-xl md:text-2xl font-bold tracking-tight", inline(line.replace(/^#\s+/, ""))));
      i++;
      continue;
    }

    // Empty line => spacing
    if (/^\s*$/.test(line)) {
      push(`<div class="h-2"></div>`);
      i++;
      continue;
    }

    // Paragraph (inline formatting)
    push(`<p class="text-sm leading-relaxed">${inline(line)}</p>`);
    i++;
  }

  return parts.join("\n");
}

// Inline formatting for bold/italic/code/links/images/backtick URLs
function inline(s: string): string {
  let t = s;
  // images ![alt](url)
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
    return `<img src="${src}" alt="${escapeHtml(alt)}" class="max-w-full rounded-lg border border-border my-2" />`;
  });
  // links [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="text-primary underline" href="$2" target="_blank" rel="noreferrer">$1</a>');
  // backtick URL `https://...`
  t = t.replace(/`(https?:\/\/[^`]+)`/g, '<a class="text-primary underline" href="$1" target="_blank" rel="noreferrer">$1</a>');
  // bold **text**
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italic *text*
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // inline code `code`
  t = t.replace(/`([^`]+)`/g, (_m, code) => `<code class="bg-background border border-border rounded px-1">${escapeHtml(code)}</code>`);
  return t;
}

export default async function DocDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const primaryDir = path.join(process.cwd(), "docs"); // frontend/docs
  const fallbackDir = path.resolve(process.cwd(), "..", "docs"); // root/docs
  const candidates = [`${slug}.md`, `${slug}.mdx`];
  let filePath = "";
  for (const name of candidates) {
    const p1 = path.join(primaryDir, name);
    const p2 = path.join(fallbackDir, name);
    try {
      await fs.promises.access(p1);
      filePath = p1;
      break;
    } catch {}
    try {
      await fs.promises.access(p2);
      filePath = p2;
      break;
    } catch {}
  }
  if (!filePath) return notFound();
  const content = await fs.promises.readFile(filePath, "utf-8");
  const html = mdToHtml(content);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader title={slug} description={`/docs/${path.basename(filePath)}`} />
      <Card className="bg-surface border-border">
        <CardContent className="p-4 md:p-6">
          <article className="space-y-4 text-sm leading-relaxed">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </article>
        </CardContent>
      </Card>
    </div>
  );
}
