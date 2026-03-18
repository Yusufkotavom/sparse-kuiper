"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Loader2, Zap } from "lucide-react"

type Props = {
  selectedCount: number
  selectedPreset: string
  suffix: string
  isRunning?: boolean
  onSuffixChange: (v: string) => void
  onRun: () => void
}

export function StudioRunBar({ selectedCount, selectedPreset, suffix, isRunning = false, onSuffixChange, onRun }: Props) {
  return (
    <Card className="bg-sky-500/5 border-sky-500/20">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-sky-400">Ringkasan</h4>
          <CheckCircle2 className="w-4 h-4 text-sky-400" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Video Terpilih:</span>
            <span className="text-foreground font-medium">{selectedCount} file</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Preset:</span>
            <span className="text-foreground font-medium">{selectedPreset || "-"}</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Nama File Output (Suffix)</Label>
          <div className="flex items-center gap-2">
            <div className="text-[10px] bg-muted px-2 py-2 rounded border border-border text-muted-foreground font-mono">
              filename
            </div>
            <Input
              value={suffix}
              onChange={(e) => onSuffixChange(e.target.value)}
              className="bg-background border-border text-xs h-9 font-mono"
              disabled={isRunning}
            />
            <div className="text-[10px] bg-muted px-2 py-2 rounded border border-border text-muted-foreground font-mono">
              .mp4
            </div>
          </div>
        </div>
        <Button
          className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 shadow-lg shadow-sky-600/20"
          disabled={selectedCount === 0 || !selectedPreset || isRunning}
          onClick={onRun}
        >
          {isRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
          {isRunning ? "Menjalankan Job..." : `Run Looper ${selectedCount > 1 ? `(Batch ${selectedCount})` : "(Single)"}`}
        </Button>
      </CardContent>
    </Card>
  )
}
