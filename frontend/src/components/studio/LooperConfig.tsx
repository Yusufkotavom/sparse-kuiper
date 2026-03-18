"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { looperApi, LooperPreset } from "@/lib/api"
import { CircleHelp, Scissors, Shuffle, Wand2, UploadCloud, Save, Trash2, Loader2 } from "lucide-react"

type Props = {
  projectName?: string
  presets: LooperPreset[]
  selectedPreset: string
  onChangePreset: (name: string) => void
  config: LooperPreset | null
  onChangeConfig: (cfg: LooperPreset) => void
  onSavePreset?: () => void
  onDeletePreset?: () => void
  disablePresetActions?: boolean
}

type LooperPresetFieldsProps = {
  projectName?: string
  config: LooperPreset
  onChangeConfig: (cfg: LooperPreset) => void
}

type SceneMixerSource = "original" | "folder" | "selected"
type SceneMixerOrder = "random" | "sequential"
type ZoomMode = "random" | "manual"
type Resolution = LooperPreset["resolution"]
type TransitionType = "none" | "crossfade" | "dip_to_black" | "glitch"
type WatermarkPosition =
  | "top_left"
  | "top_center"
  | "top_right"
  | "center_left"
  | "center"
  | "center_right"
  | "bottom_left"
  | "bottom_center"
  | "bottom_right"
type EffectKey =
  | "effect_speed_ramping"
  | "effect_color_tweaking"
  | "effect_film_grain"
  | "effect_pulsing_vignette"

function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <CircleHelp className="w-3.5 h-3.5" />
          </button>
        }
      />
      <TooltipContent className="max-w-xs text-[11px] leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

export function LooperPresetFields({ projectName, config, onChangeConfig }: LooperPresetFieldsProps) {
  const effectOptions: { id: EffectKey; label: string }[] = [
    { id: "effect_speed_ramping", label: "Speed Ramping (Acak Kecepatan)" },
    { id: "effect_color_tweaking", label: "Color Tweaking (Acak Kecerahan/Saturasi)" },
    { id: "effect_film_grain", label: "Film Grain / Noise" },
    { id: "effect_pulsing_vignette", label: "Pulsing Vignette" }
  ]

  // Ensure default values for new fields
  const c = {
    enable_looper: config.enable_looper ?? true,
    enable_scene_mixer: config.enable_scene_mixer ?? false,
    scene_mixer_clip_count: config.scene_mixer_clip_count ?? 10,
    scene_mixer_order: config.scene_mixer_order ?? "random",
    scene_mixer_full_duration: config.scene_mixer_full_duration ?? false,
    scene_mixer_max_duration: config.scene_mixer_max_duration ?? 5.0,
    effect_mirror: config.effect_mirror ?? false,
    effect_speed_ramping: config.effect_speed_ramping ?? false,
    effect_color_tweaking: config.effect_color_tweaking ?? false,
    effect_film_grain: config.effect_film_grain ?? false,
    effect_pulsing_vignette: config.effect_pulsing_vignette ?? false,
    effect_zoom_crop: config.effect_zoom_crop ?? false,
    effect_zoom_mode: config.effect_zoom_mode ?? "random",
    effect_zoom_percent: config.effect_zoom_percent ?? 90,
    transition_type: config.transition_type ?? "none",
    watermark_scale: config.watermark_scale ?? 50,
    watermark_opacity: config.watermark_opacity ?? 100,
    watermark_position: config.watermark_position ?? "bottom_right",
    watermark_margin_x: config.watermark_margin_x ?? 24,
    watermark_margin_y: config.watermark_margin_y ?? 24,
    watermark_key_black: config.watermark_key_black ?? false,
    watermark_key_green: config.watermark_key_green ?? false,
    ...config,
  }

  const update = (updates: Partial<LooperPreset>) => {
    onChangeConfig({ ...config, ...updates })
  }
  const [watermarkEnabled, setWatermarkEnabled] = React.useState(Boolean((config.watermark_url || "").trim()))

  React.useEffect(() => {
    const hasUrl = Boolean((config.watermark_url || "").trim())
    if (hasUrl) setWatermarkEnabled(true)
  }, [config.watermark_url])

  const watermarkInputRef = React.useRef<HTMLInputElement | null>(null)
  const [isUploadingWatermark, setIsUploadingWatermark] = React.useState(false)
  const [watermarkMessage, setWatermarkMessage] = React.useState("")

  const handleWatermarkUpload = async (file: File | null) => {
    if (!file) return
    if (!projectName) {
      setWatermarkMessage("Project belum dipilih, upload watermark ditunda.")
      return
    }

    setIsUploadingWatermark(true)
    setWatermarkMessage("")
    try {
      const result = await looperApi.uploadWatermark(projectName, file)
      update({ watermark_url: result.relative_path })
      setWatermarkMessage(`Upload berhasil: ${result.filename}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Upload watermark gagal"
      setWatermarkMessage(message)
    } finally {
      setIsUploadingWatermark(false)
    }
  }

  return (
    <TooltipProvider delay={120}>
    <div className="space-y-6">
      {/* 1. AUTO SCENE MIXER SECTION */}
      <div className="rounded-xl bg-background/50 border border-border/50 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-muted/20 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Auto Scene Mixer (Anti-Reused Content)</h3>
          </div>
          <Switch 
            checked={!!c.enable_scene_mixer} 
            onCheckedChange={(v) => update({ enable_scene_mixer: v })} 
          />
        </div>

        {c.enable_scene_mixer && (
          <div className="p-4 space-y-6">
            <p className="text-xs text-muted-foreground -mt-2">
              Gabungkan kembali klip-klip video secara acak dengan filter unik untuk menghindari deteksi konten berulang. Ideal untuk B-Roll.
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-bold text-foreground">Sumber Klip</Label>
                <InfoHint text="Original memakai video yang sedang diproses. Folder sampling dari file lain dalam folder yang sama. Pilihan memakai kumpulan video yang kamu centang di daftar raw video." />
              </div>
              <Select value={c.scene_mixer_source || "original"} onValueChange={(v) => update({ scene_mixer_source: v as SceneMixerSource })}>
                <SelectTrigger className="h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Langsung dari Video Original (skip split)</SelectItem>
                  <SelectItem value="selected">Dari Video yang Dipilih (Manual Pool)</SelectItem>
                  <SelectItem value="folder">Dari Folder Video Saat Ini</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs font-bold text-foreground">Jumlah Klip Digabung</Label>
                  <InfoHint text="Semakin banyak klip, hasil makin variatif tetapi proses render lebih berat." />
                </div>
                <Input
                  type="number"
                  value={c.scene_mixer_clip_count}
                  onChange={(e) => update({ scene_mixer_clip_count: parseInt(e.target.value) || 1 })}
                  className="h-7 w-16 text-center text-xs"
                />
              </div>
              <Slider
                value={[c.scene_mixer_clip_count]}
                min={1}
                max={50}
                step={1}
                onValueChange={([v]) => update({ scene_mixer_clip_count: v })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Urutan Klip</Label>
                    <InfoHint text="Random mengacak urutan scene. Sequential menjaga urutan natural dari sumber." />
                  </div>
                  <Select value={c.scene_mixer_order} onValueChange={(v) => update({ scene_mixer_order: v as SceneMixerOrder })}>
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Acak (Random)</SelectItem>
                      <SelectItem value="sequential">Berurutan (Sequential)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={!!c.scene_mixer_full_duration} 
                    onCheckedChange={(v) => update({ scene_mixer_full_duration: v })}
                    id="full_duration"
                  />
                  <Label htmlFor="full_duration" className="text-xs cursor-pointer">Durasi Penuh (tanpa potong)</Label>
                </div>

                {!c.scene_mixer_full_duration && (
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-foreground">Durasi Maksimal per Klip (Detik)</Label>
                      <Input
                        type="number"
                        value={c.scene_mixer_max_duration}
                        onChange={(e) => update({ scene_mixer_max_duration: parseFloat(e.target.value) || 1 })}
                        className="h-7 w-16 text-center text-xs"
                        step={0.5}
                      />
                    </div>
                    <Slider
                      value={[c.scene_mixer_max_duration]}
                      min={1}
                      max={300}
                      step={0.5}
                      onValueChange={([v]) => update({ scene_mixer_max_duration: v })}
                    />
                  </div>
                )}
                
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Resolusi Output</Label>
                    <InfoHint text="Landscape cocok YouTube, Portrait cocok Shorts/Reels/TikTok." />
                  </div>
                  <Select
                    value={c.resolution}
                    onValueChange={(v) => update({ resolution: v as Resolution })}
                  >
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-bold">📱 Portrait (9:16)</div>
                      <SelectItem value="1080p_p">1080 × 1920 — Full HD Portrait</SelectItem>
                      <SelectItem value="720p_p">720 × 1280 — HD Portrait</SelectItem>
                      <SelectItem value="480p_p">480 × 854 — SD Portrait</SelectItem>
                      <div className="px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-bold mt-1">🖥️ Landscape (16:9)</div>
                      <SelectItem value="1080p">1920 × 1080 — Full HD Landscape</SelectItem>
                      <SelectItem value="720p">1280 × 720 — HD Landscape</SelectItem>
                      <SelectItem value="480p">854 × 480 — SD Landscape</SelectItem>
                      <div className="px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-bold mt-1">⚙️ Lainnya</div>
                      <SelectItem value="original">Original (Tidak Diubah)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Checkbox 
                    checked={!!c.effect_zoom_crop} 
                    onCheckedChange={(v) => update({ effect_zoom_crop: v })}
                    id="zoom_crop"
                  />
                  <Label htmlFor="zoom_crop" className="text-xs cursor-pointer">Zoom / Crop</Label>
                  <InfoHint text="Efek framing: zoom in memperbesar area tengah, zoom out mengecilkan lalu menambah padding." />
                </div>
                {c.effect_zoom_crop && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold">Mode Zoom</Label>
                        <InfoHint text="Acak akan menghasilkan variasi zoom in otomatis per video. Manual pakai persentase tetap." />
                      </div>
                      <Select
                        value={c.effect_zoom_mode}
                        onValueChange={(v) => update({ effect_zoom_mode: v as ZoomMode })}
                      >
                        <SelectTrigger className="h-8 bg-background text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="random">Acak (Zoom In)</SelectItem>
                          <SelectItem value="manual">Manual (%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {c.effect_zoom_mode === "manual" && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <Label className="text-[10px] text-muted-foreground uppercase font-bold">Persentase Zoom</Label>
                            <InfoHint text="90 berarti zoom in, 100 normal, 110 zoom out." />
                          </div>
                          <Input
                            type="number"
                            value={c.effect_zoom_percent}
                            onChange={(e) => update({ effect_zoom_percent: parseFloat(e.target.value) || 100 })}
                            className="h-7 w-20 text-center text-xs"
                          />
                        </div>
                        <Slider
                          value={[c.effect_zoom_percent]}
                          min={50}
                          max={200}
                          step={1}
                          onValueChange={([v]) => update({ effect_zoom_percent: v })}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          90 = zoom in, 100 = normal, 110 = zoom out
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Effects Right Column */}
              <div className="space-y-4 bg-muted/10 p-4 rounded-lg border border-border/30">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-2">
                    <Wand2 className="w-3.5 h-3.5" />
                    Mirror Video (Flip Horizontal)
                  </Label>
                  <Select 
                    value={c.effect_mirror ? "yes" : "no"} 
                    onValueChange={(v) => update({ effect_mirror: v === "yes" })}
                  >
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Tidak Pernah</SelectItem>
                      <SelectItem value="yes">Selalu / Acak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 pt-2">
                  {effectOptions.map((effect) => (
                    <div key={effect.id} className="flex items-center gap-2">
                      <Checkbox 
                        checked={!!c[effect.id]} 
                        onCheckedChange={(v) => update({ [effect.id]: v === true } as Partial<LooperPreset>)}
                        id={effect.id}
                      />
                      <Label htmlFor={effect.id} className="text-xs cursor-pointer">{effect.label}</Label>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-4">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-bold text-foreground">Transisi antar klip</Label>
                    <InfoHint text="Crossfade lebih halus, dip to black dramatis, glitch untuk gaya agresif." />
                  </div>
                  <Select value={c.transition_type} onValueChange={(v) => update({ transition_type: v as TransitionType })}>
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa Transisi (Hard Cut)</SelectItem>
                      <SelectItem value="crossfade">Crossfade</SelectItem>
                      <SelectItem value="dip_to_black">Dip to Black</SelectItem>
                      <SelectItem value="glitch">Glitch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/50 space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold text-foreground">Watermark / Overlay</Label>
                  <p className="text-[10px] text-muted-foreground">Aktifkan jika ingin menambahkan logo atau overlay video.</p>
                </div>
                <Switch
                  checked={watermarkEnabled}
                  onCheckedChange={(v) => {
                    if (v) {
                      setWatermarkEnabled(true)
                      setWatermarkMessage("Watermark aktif. Upload file atau isi path watermark.")
                      return
                    }
                    setWatermarkEnabled(false)
                    update({ watermark_url: "" })
                    setWatermarkMessage("Watermark dimatikan.")
                  }}
                />
              </div>

              {watermarkEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-bold text-foreground">Upload Watermark / Overlay (Image atau Video)</Label>
                      <InfoHint text="Bisa file gambar atau video. Watermark video akan di-loop agar sepanjang durasi output." />
                    </div>
                    <div
                      className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-lg p-4 flex items-center justify-between bg-muted/20 cursor-pointer"
                      onClick={() => watermarkInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const dropped = e.dataTransfer?.files?.[0] || null
                        void handleWatermarkUpload(dropped)
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <UploadCloud className="w-6 h-6 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Drag and drop file here</p>
                          <p className="text-[10px] text-muted-foreground">PNG/JPG/JPEG/WEBP/MP4/MOV/WEBM/MKV/AVI/M4V</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs"
                        disabled={isUploadingWatermark || !projectName}
                      >
                        {isUploadingWatermark ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          "Browse files"
                        )}
                      </Button>
                    </div>
                    <input
                      ref={watermarkInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.mp4,.mov,.webm,.mkv,.avi,.m4v,image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo"
                      className="hidden"
                      onChange={(e) => {
                        void handleWatermarkUpload(e.target.files?.[0] || null)
                        e.currentTarget.value = ""
                      }}
                    />
                    <Input
                      value={c.watermark_url || ""}
                      onChange={(e) => update({ watermark_url: e.target.value })}
                      placeholder="watermarks/logo.png atau https://..."
                      className="h-9 bg-background text-xs"
                    />
                    {watermarkMessage && (
                      <p className="text-[10px] text-muted-foreground">{watermarkMessage}</p>
                    )}
                  </div>
                  <div className="space-y-5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-foreground">Skala Watermark (%)</Label>
                      <Input
                        type="number"
                        value={c.watermark_scale}
                        onChange={(e) => update({ watermark_scale: parseInt(e.target.value) || 100 })}
                        className="h-7 w-16 text-center text-xs"
                      />
                    </div>
                    <Slider
                      value={[c.watermark_scale]}
                      min={10}
                      max={100}
                      step={1}
                      onValueChange={([v]) => update({ watermark_scale: v })}
                    />

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-foreground">Chroma Key (Opsional)</Label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={!!c.watermark_key_black}
                            onCheckedChange={(v) => update({ watermark_key_black: Boolean(v) })}
                            id="wm_key_black"
                          />
                          <Label htmlFor="wm_key_black" className="text-xs cursor-pointer">Buang background hitam</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={!!c.watermark_key_green}
                            onCheckedChange={(v) => update({ watermark_key_green: Boolean(v) })}
                            id="wm_key_green"
                          />
                          <Label htmlFor="wm_key_green" className="text-xs cursor-pointer">Buang green screen</Label>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-foreground">Opacity (%)</Label>
                      <Input
                        type="number"
                        value={c.watermark_opacity}
                        onChange={(e) => update({ watermark_opacity: parseInt(e.target.value) || 100 })}
                        className="h-7 w-16 text-center text-xs"
                      />
                    </div>
                    <Slider
                      value={[c.watermark_opacity]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([v]) => update({ watermark_opacity: v })}
                    />

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-foreground">Posisi</Label>
                      <Select
                        value={c.watermark_position}
                        onValueChange={(v) => update({ watermark_position: v as WatermarkPosition })}
                      >
                        <SelectTrigger className="h-9 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top_left">Atas Kiri</SelectItem>
                          <SelectItem value="top_center">Atas Tengah</SelectItem>
                          <SelectItem value="top_right">Atas Kanan</SelectItem>
                          <SelectItem value="center_left">Tengah Kiri</SelectItem>
                          <SelectItem value="center">Tengah</SelectItem>
                          <SelectItem value="center_right">Tengah Kanan</SelectItem>
                          <SelectItem value="bottom_left">Bawah Kiri</SelectItem>
                          <SelectItem value="bottom_center">Bawah Tengah</SelectItem>
                          <SelectItem value="bottom_right">Bawah Kanan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold">Margin X</Label>
                        <Input
                          type="number"
                          value={c.watermark_margin_x}
                          onChange={(e) => update({ watermark_margin_x: parseInt(e.target.value) || 0 })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold">Margin Y</Label>
                        <Input
                          type="number"
                          value={c.watermark_margin_y}
                          onChange={(e) => update({ watermark_margin_y: parseInt(e.target.value) || 0 })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. BASIC LOOPER SECTION */}
      <div className="rounded-xl bg-background/50 border border-border/50 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-muted/20 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Basic Looper Settings</h3>
          </div>
          <Switch 
            checked={!!c.enable_looper} 
            onCheckedChange={(v) => update({ enable_looper: v })} 
          />
        </div>

        {c.enable_looper && (
          <div className="p-4 space-y-6">
            {/* Previous Looper Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">Mode Durasi</Label>
                <Select
                  value={c.mode}
                  onValueChange={(v: unknown) => update({ mode: v as "manual" | "target" | "audio" })}
                >
                  <SelectTrigger className="h-9 bg-background border-border text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-xs">
                    <SelectItem value="manual">Manual (Jumlah Loop)</SelectItem>
                    <SelectItem value="target">Target Durasi (Detik)</SelectItem>
                    <SelectItem value="audio">Ikuti Durasi Audio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                {c.mode === "manual" && (
                  <>
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">Jumlah Loop</Label>
                    <Input
                      type="number"
                      value={c.default_loops}
                      onChange={(e) => update({ default_loops: parseInt(e.target.value) || 1 })}
                      className="h-9 bg-background border-border text-xs"
                    />
                  </>
                )}
                {c.mode === "target" && (
                  <>
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">Target (Detik)</Label>
                    <Input
                      type="number"
                      value={c.target_duration}
                      onChange={(e) => update({ target_duration: parseInt(e.target.value) || 15 })}
                      className="h-9 bg-background border-border text-xs"
                    />
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/30 pb-1">
                Potongan & Crossfade
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold">Potong Awal Video</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={c.cut_start}
                      onChange={(e) => update({ cut_start: parseFloat(e.target.value) || 0 })}
                      className="h-7 w-16 bg-background border-border text-[10px] text-center font-mono"
                      step={0.5}
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">s</span>
                  </div>
                </div>
                <Slider
                  value={[c.cut_start]}
                  min={0}
                  max={10}
                  step={0.5}
                  onValueChange={([v]) => update({ cut_start: v })}
                  className="py-2"
                />
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 border border-border/30">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">Nonaktifkan Crossfade</Label>
                <Switch
                  checked={!!c.disable_crossfade}
                  onCheckedChange={(v) => update({ disable_crossfade: v })}
                />
              </div>
              {!c.disable_crossfade && (
                <div className="space-y-3 pt-1">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">Durasi Crossfade</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={c.crossfade_duration}
                        onChange={(e) => update({ crossfade_duration: parseFloat(e.target.value) || 0 })}
                        className="h-7 w-16 bg-background border-border text-[10px] text-center font-mono"
                        step={0.1}
                      />
                      <span className="text-[10px] text-muted-foreground font-mono">s</span>
                    </div>
                  </div>
                  <Slider
                    value={[c.crossfade_duration]}
                    min={0.1}
                    max={5}
                    step={0.1}
                    onValueChange={([v]) => update({ crossfade_duration: v })}
                    className="py-2"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/30 pb-1">
                Audio Settings
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 border border-border/30">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold">Mute Original</Label>
                  <Switch
                    checked={!!c.mute_original_audio}
                    onCheckedChange={(v) => update({ mute_original_audio: v })}
                  />
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 border border-border/30">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold">Audio Fade</Label>
                  <Switch
                    checked={!!c.enable_audio_fade}
                    onCheckedChange={(v) => update({ enable_audio_fade: v })}
                  />
                </div>
              </div>
              {c.enable_audio_fade && (
                <div className="space-y-3 pt-1">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">Audio Fade Duration</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={c.audio_fade_duration}
                        onChange={(e) => update({ audio_fade_duration: parseFloat(e.target.value) || 0.5 })}
                        className="h-7 w-16 bg-background border-border text-[10px] text-center font-mono"
                        step={0.5}
                      />
                      <span className="text-[10px] text-muted-foreground font-mono">s</span>
                    </div>
                  </div>
                  <Slider
                    value={[c.audio_fade_duration]}
                    min={0.5}
                    max={5}
                    step={0.5}
                    onValueChange={([v]) => update({ audio_fade_duration: v })}
                    className="py-2"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-border/30">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold block">Render Quality</Label>
              <div className="grid grid-cols-3 gap-1 max-w-[300px]">
                {["high", "medium", "low"].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => update({ quality: q as "high" | "medium" | "low" })}
                    className={`px-1 py-1.5 rounded text-[10px] capitalize border transition-all ${
                      c.quality === q
                        ? "bg-primary/20 border-primary/50 text-primary font-bold shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:border-muted-foreground/30"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/30">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold block">Resolusi Output</Label>
              <Select
                value={c.resolution}
                onValueChange={(v) => update({ resolution: v as Resolution })}
              >
                <SelectTrigger className="h-9 bg-background text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-bold">📱 Portrait (9:16)</div>
                  <SelectItem value="1080p_p" className="text-xs">1080 × 1920 — Full HD Portrait</SelectItem>
                  <SelectItem value="720p_p"  className="text-xs">720 × 1280 — HD Portrait</SelectItem>
                  <SelectItem value="480p_p"  className="text-xs">480 × 854 — SD Portrait</SelectItem>
                  <div className="px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-bold mt-1">🖥️ Landscape (16:9)</div>
                  <SelectItem value="1080p"   className="text-xs">1920 × 1080 — Full HD Landscape</SelectItem>
                  <SelectItem value="720p"    className="text-xs">1280 × 720 — HD Landscape</SelectItem>
                  <SelectItem value="480p"    className="text-xs">854 × 480 — SD Landscape</SelectItem>
                  <div className="px-2 py-1 text-[9px] text-muted-foreground uppercase tracking-wider font-bold mt-1">⚙️</div>
                  <SelectItem value="original" className="text-xs">Original (Tidak Diubah)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  )
}

export const LooperConfig: React.FC<Props> = ({
  projectName,
  presets,
  selectedPreset,
  onChangePreset,
  config,
  onChangeConfig,
  onSavePreset,
  onDeletePreset,
  disablePresetActions = false,
}) => {
  const current = React.useMemo(() => presets.find((p) => p.name === selectedPreset), [presets, selectedPreset])

  if (!config) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs text-muted-foreground">Preset Looper</Label>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px] gap-1.5"
              onClick={onSavePreset}
              disabled={disablePresetActions || !onSavePreset || !config}
            >
              <Save className="w-3 h-3" />
              Save as Preset
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px] gap-1.5 text-red-400 border-red-500/30 hover:text-red-300 hover:border-red-500/50"
              onClick={onDeletePreset}
              disabled={disablePresetActions || !onDeletePreset || !selectedPreset}
            >
              <Trash2 className="w-3 h-3" />
              Delete Preset
            </Button>
          </div>
        </div>
        <Select value={selectedPreset} onValueChange={(v: unknown) => onChangePreset(v as string)}>
          <SelectTrigger className="bg-background border-border text-sm h-10">
            <SelectValue placeholder="Pilih preset looper..." />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {presets.map((p) => (
              <SelectItem key={p.name} value={p.name} className="text-xs">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {current && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
          <p className="text-[11px] text-foreground font-medium">{current.description}</p>
          <div className="flex flex-wrap gap-2">
            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 uppercase font-bold tracking-wider">
              {config.mode}
            </span>
            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border">
              {config.resolution.includes("_p") ? "Portrait" : config.resolution === "original" ? "Original" : "Landscape"}
            </span>
            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border">
              {config.resolution.replace("_p", "")}
            </span>
            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border">
              Cut: {config.cut_start}s
            </span>
            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border">
              Fade: {config.disable_crossfade ? "No" : `${config.crossfade_duration}s`}
            </span>
            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border">
              Audio: {config.mute_original_audio ? "Mute" : "Original"}
            </span>
            {config.enable_audio_fade && (
              <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                AFade: {config.audio_fade_duration}s
              </span>
            )}
          </div>
        </div>
      )}

      <LooperPresetFields projectName={projectName} config={config} onChangeConfig={onChangeConfig} />

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => current && onChangeConfig({ ...current })}
          className="h-8 text-[10px] uppercase font-bold text-muted-foreground hover:text-primary"
        >
          Reset ke Preset
        </Button>
      </div>
    </div>
  )
}
