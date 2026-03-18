"use client"

import { useMemo } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Play, Search, Info } from "lucide-react"

type Props = {
  assets: string[]
  search: string
  onSearch: (v: string) => void
  selected: string[]
  onToggle: (asset: string) => void
  onToggleAll: () => void
  title?: string
  description?: string
}

export function StudioAssetSelector({
  assets,
  search,
  onSearch,
  selected,
  onToggle,
  onToggleAll,
  title = "Raw Videos",
  description = "Pilih video yang ingin diproses.",
}: Props) {
  const filtered = useMemo(() => {
    return assets.filter((v) => v.split("/").pop()?.toLowerCase().includes(search.toLowerCase()))
  }, [assets, search])

  return (
    <TooltipProvider delay={120}>
    <Card className="bg-surface border-border flex flex-col max-h-[calc(100vh-160px)] lg:max-h-[calc(100vh-200px)]">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              {title}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button type="button" className="inline-flex text-muted-foreground hover:text-foreground">
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  }
                />
                <TooltipContent className="max-w-xs text-[11px] leading-relaxed">
                  Klik baris untuk memilih video. Gunakan cari file untuk filter cepat, lalu jalankan batch.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription className="text-[11px] mt-0.5">{description}</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Cari file..."
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className="h-8 w-full sm:w-40 pl-7 text-[11px] bg-background border-border"
              />
            </div>
            <div className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-1 rounded border border-border text-center">
              {selected.length} / {filtered.length} terpilih
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto flex-1">
        {filtered.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <p className="text-muted-foreground text-sm">Tidak ada video mentah ditemukan.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            <div className="flex items-center gap-3 p-3 bg-muted/20 sticky top-0 z-10">
              <Checkbox
                checked={selected.length === filtered.length && filtered.length > 0}
                onCheckedChange={onToggleAll}
              />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Pilih Semua
              </span>
            </div>
            {filtered.map((video) => {
              const filename = video.split("/").pop() || video
              const isSelected = selected.includes(video)
              return (
                <div
                  key={video}
                  onClick={() => onToggle(video)}
                  className={`grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 p-2.5 sm:p-3 hover:bg-muted/30 transition-colors cursor-pointer group ${
                    isSelected ? "bg-sky-500/5" : ""
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggle(video)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0 border border-border group-hover:border-sky-500/30 transition-colors">
                    <Play className="w-4 h-4 text-muted-foreground group-hover:text-sky-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${isSelected ? "text-sky-400" : "text-foreground"}`}>
                      {filename}
                    </p>
                    <p className="text-[10px] text-muted-foreground">raw_videos</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Info className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      }
                    />
                    <TooltipContent className="max-w-xs text-[11px] leading-relaxed">
                      <p className="font-medium">{filename}</p>
                      <p className="text-muted-foreground">{video}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
    </TooltipProvider>
  )
}
