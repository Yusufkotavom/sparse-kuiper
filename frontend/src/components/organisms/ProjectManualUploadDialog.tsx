"use client";

import { useEffect, useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { videoApi, type ProjectVideoUploadResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProjectManualUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onUploaded?: (
    result: ProjectVideoUploadResponse,
    options: { fastTrack: boolean; targetStage: "raw" | "final" },
  ) => Promise<void> | void;
};

export function ProjectManualUploadDialog({
  open,
  onOpenChange,
  projectName,
  onUploaded,
}: ProjectManualUploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetStage, setTargetStage] = useState<"raw" | "final">("raw");
  const [fastTrack, setFastTrack] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const selectedCount = selectedFiles.length;
  const helperText = useMemo(() => {
    if (targetStage === "final") {
      return "Cocok untuk file final yang ingin cepat dilanjutkan ke Queue Builder.";
    }
    return "Cocok untuk simpan source video dulu di project sebelum diolah lagi.";
  }, [targetStage]);

  useEffect(() => {
    if (!open) {
      setSelectedFiles([]);
      setTargetStage("raw");
      setFastTrack(true);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return;
    setSubmitting(true);
    try {
      const result = await videoApi.uploadProjectVideos(projectName, selectedFiles, { targetStage });
      await onUploaded?.(result, { fastTrack, targetStage });
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4" />
            Manual Upload to Project
          </DialogTitle>
          <DialogDescription>
            Upload video langsung ke project <span className="font-medium text-foreground">{projectName}</span> lalu
            lanjutkan ke Queue Builder bila perlu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-manual-upload-files">Video files</Label>
            <Input
              id="project-manual-upload-files"
              type="file"
              accept=".mp4,.mov,.webm,.m4v,.avi,video/*"
              multiple
              disabled={submitting}
              onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
            />
            <p className="text-xs text-muted-foreground">
              Mendukung upload banyak file sekaligus. File duplikat akan otomatis diberi nama unik.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Target stage</Label>
            <Select value={targetStage} onValueChange={(value) => setTargetStage(value as "raw" | "final")}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface border-border">
                <SelectItem value="raw">Raw</SelectItem>
                <SelectItem value="final">Final</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{helperText}</p>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3">
            <Checkbox checked={fastTrack} onCheckedChange={setFastTrack} />
            <span className="space-y-1 text-sm">
              <span className="block font-medium text-foreground">Fast track ke Queue Builder</span>
              <span className="block text-xs text-muted-foreground">
                Setelah upload selesai, file akan otomatis masuk queue dan Queue Builder langsung dibuka.
              </span>
            </span>
          </label>

          <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            {selectedCount > 0 ? `${selectedCount} file siap diupload.` : "Belum ada file yang dipilih."}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting || selectedCount === 0}>
            {submitting ? "Uploading..." : fastTrack ? "Upload + Open Queue Builder" : "Upload to Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
