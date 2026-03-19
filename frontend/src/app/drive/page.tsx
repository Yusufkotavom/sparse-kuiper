"use client"
import { useEffect, useMemo, useState } from "react"
import { accountsApi, driveApi, Account } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator, BreadcrumbPage, BreadcrumbLink } from "@/components/ui/breadcrumb"
import { Checkbox } from "@/components/ui/checkbox"
import { FolderPlus, Upload as UploadIcon, ArrowRight, CheckSquare, XCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useSystemUi } from "@/components/system/SystemUiProvider"

type DriveFile = { id: string; name: string; mimeType: string; parents?: string[] }

export default function DriveExplorerPage() {
  const { prompt } = useSystemUi()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [files, setFiles] = useState<DriveFile[]>([])
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [parentId, setParentId] = useState<string | undefined>(undefined)
  const [pathStack, setPathStack] = useState<Array<{ id?: string; name: string }>>([{ id: undefined, name: "Root" }])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<number>(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState("")
  const [authUrl, setAuthUrl] = useState<string>("")
  const [connectCode, setConnectCode] = useState("")
  const [newAccountName, setNewAccountName] = useState("My Google Drive")
  const [authError, setAuthError] = useState<string>("")
  const hasDriveAccount = useMemo(() => accounts.some(a => a.platform === "google_drive"), [accounts])
  const selectedAcc = useMemo(() => accounts.find(a => (a.id || "") === selectedAccountId), [accounts, selectedAccountId])
  const isConnected = (selectedAcc?.status || "").toLowerCase() === "active"
  const [gotoInput, setGotoInput] = useState("")
  const [bookmarkAlias, setBookmarkAlias] = useState("")
  const [bookmarks, setBookmarks] = useState<Array<{ alias: string; accountId: string; folderId: string }>>([])
  const [listStatus, setListStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [listError, setListError] = useState<string>("")
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)

  useEffect(() => {
    accountsApi.getAccounts().then(res => {
      const list = res.accounts.filter(a => a.platform === "google_drive")
      setAccounts(list)
      if (list.length > 0 && !selectedAccountId) setSelectedAccountId(list[0].id || "")
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedAccountId) return
    if (!isConnected) return
    setLoading(true)
    setListError("")
    setListStatus("loading")
    driveApi.list({ account_id: selectedAccountId, parent_id: parentId })
      .then(res => {
        setFiles(res.files || [])
        setListStatus("success")
        setLastUpdatedAt(Date.now())
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Gagal memuat daftar file"
        setListError(msg)
        setListStatus("error")
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }, [selectedAccountId, parentId, isConnected])

  useEffect(() => {
    try {
      const raw = localStorage.getItem("driveBookmarks") || "[]"
      const arr = JSON.parse(raw)
      setBookmarks(arr || [])
    } catch {}
  }, [])

  function saveBookmarks(next: Array<{ alias: string; accountId: string; folderId: string }>) {
    setBookmarks(next)
    try { localStorage.setItem("driveBookmarks", JSON.stringify(next)) } catch {}
  }

  function parseDriveId(input: string): string | null {
    const s = input.trim()
    if (!s) return null
    if (s.includes("/folders/")) {
      const m = s.match(/\/folders\/([A-Za-z0-9_-]+)/)
      return m?.[1] || null
    }
    if (s.includes("id=")) {
      const m = s.match(/[?&]id=([A-Za-z0-9_-]+)/)
      return m?.[1] || null
    }
    return s
  }

  async function gotoFolder() {
    const id = parseDriveId(gotoInput)
    if (!id || !selectedAccountId) return
    setParentId(id)
    setSelectedIds({})
    try {
      const meta = await driveApi.getMeta(selectedAccountId, id)
      setPathStack([{ id: undefined, name: "Root" }, { id, name: meta.name || id }])
    } catch {
      setPathStack([{ id: undefined, name: "Root" }, { id, name: id }])
    }
  }

  function addBookmark() {
    if (!selectedAccountId || !bookmarkAlias.trim() || !parentId) return
    const exists = bookmarks.some(b => b.alias === bookmarkAlias.trim() && b.accountId === selectedAccountId)
    const next = exists
      ? bookmarks.map(b => (b.alias === bookmarkAlias.trim() && b.accountId === selectedAccountId ? { ...b, folderId: parentId } : b))
      : [...bookmarks, { alias: bookmarkAlias.trim(), accountId: selectedAccountId, folderId: parentId }]
    saveBookmarks(next)
    setBookmarkAlias("")
  }

  async function openBookmark(b: { alias: string; accountId: string; folderId: string }) {
    setSelectedAccountId(b.accountId)
    setParentId(b.folderId)
    setSelectedIds({})
    try {
      const meta = await driveApi.getMeta(b.accountId, b.folderId)
      setPathStack([{ id: undefined, name: "Root" }, { id: b.folderId, name: meta.name || b.folderId }])
    } catch {
      setPathStack([{ id: undefined, name: "Root" }, { id: b.folderId, name: b.folderId }])
    }
  }

  function navigateToFolder(folder: DriveFile) {
    setParentId(folder.id)
    setPathStack(prev => [...prev, { id: folder.id, name: folder.name }])
  }

  function navigateBreadcrumb(index: number) {
    const target = pathStack[index]
    setPathStack(pathStack.slice(0, index + 1))
    setParentId(target.id)
    setSelectedIds({})
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedAccountId) return
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    setUploadProgress(0)
    try {
      await driveApi.uploadWithProgress(selectedAccountId, parentId, f, (pct) => {
        setUploadProgress(pct)
      })
      toast.success("Upload berhasil")
      const res = await driveApi.list({ account_id: selectedAccountId, parent_id: parentId })
      setFiles(res.files || [])
      setLastUpdatedAt(Date.now())
      setListStatus("success")
    } finally {
      setUploading(false)
      setUploadProgress(0)
      e.target.value = ""
    }
  }
  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds(prev => ({ ...prev, [id]: checked }))
  }
  function getSelectedIds(): string[] {
    return Object.entries(selectedIds).filter(([_, v]) => !!v).map(([id]) => id)
  }
  function selectAll() {
    const next: Record<string, boolean> = {}
    for (const f of files) {
      next[f.id] = true
    }
    setSelectedIds(next)
  }
  function clearSelection() {
    setSelectedIds({})
  }

  async function importSelectedToVideo() {
    const ids = getSelectedIds()
    if (!selectedAccountId || ids.length === 0) {
      toast.error("Pilih minimal satu file")
      return
    }
    const name = await prompt({
      title: "Import ke Video Project",
      description: "Masukkan nama project video tujuan untuk file yang dipilih.",
      placeholder: "misal: promo-short-01",
      submitLabel: "Import",
    })
    if (!name) return
    setImporting(true)
    setImportProgress(5)
    const interval = window.setInterval(() => setImportProgress(prev => Math.min(prev + 3, 95)), 300)
    try {
      const res = await driveApi.importToVideoProject({ account_id: selectedAccountId, parent_id: parentId || "", project_name: name.trim(), file_ids: ids })
      toast.success(`Import: ${res.imported} berhasil, ${res.skipped} dilewati • Project: ${res.project}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal import ke Video"
      toast.error(msg)
    } finally {
      setImporting(false)
      window.clearInterval(interval)
      setImportProgress(100)
      window.setTimeout(() => setImportProgress(0), 600)
    }
  }
  async function importSelectedToKdp() {
    const ids = getSelectedIds()
    if (!selectedAccountId || ids.length === 0) {
      toast.error("Pilih minimal satu file")
      return
    }
    const name = await prompt({
      title: "Import ke KDP Project",
      description: "Masukkan nama project KDP tujuan untuk file yang dipilih.",
      placeholder: "misal: animal-coloring-book",
      submitLabel: "Import",
    })
    if (!name) return
    setImporting(true)
    setImportProgress(5)
    const interval = window.setInterval(() => setImportProgress(prev => Math.min(prev + 3, 95)), 300)
    try {
      const res = await driveApi.importToKdpProject({ account_id: selectedAccountId, parent_id: parentId || "", project_name: name.trim(), file_ids: ids })
      toast.success(`Import: ${res.imported} berhasil, ${res.skipped} dilewati • Project: ${res.project}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal import ke KDP"
      toast.error(msg)
    } finally {
      setImporting(false)
      window.clearInterval(interval)
      setImportProgress(100)
      window.setTimeout(() => setImportProgress(0), 600)
    }
  }

  async function handleDelete(fileId: string) {
    if (!selectedAccountId) return
    setDeletingId(fileId)
    try {
      await driveApi.delete(selectedAccountId, fileId)
      const res = await driveApi.list({ account_id: selectedAccountId, parent_id: parentId })
      setFiles(res.files || [])
      setLastUpdatedAt(Date.now())
      setListStatus("success")
      toast.success("File dihapus")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal menghapus file"
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleCreateFolder() {
    if (!selectedAccountId || !newFolderName.trim()) return
    setCreatingFolder(true)
    try {
      await driveApi.createFolder({ account_id: selectedAccountId, name: newFolderName.trim(), parent_id: parentId })
      const res = await driveApi.list({ account_id: selectedAccountId, parent_id: parentId })
      setFiles(res.files || [])
      setNewFolderName("")
      setLastUpdatedAt(Date.now())
      setListStatus("success")
      toast.success("Folder dibuat")
    } finally {
      setCreatingFolder(false)
    }
  }

  async function createDriveAccount() {
    const payload: Account = { name: newAccountName.trim() || "My Google Drive", platform: "google_drive", auth_method: "api", status: "needs_login" }
    const res = await accountsApi.addAccount(payload)
    const acc = res.account
    const list = [...accounts, acc]
    setAccounts(list)
    setSelectedAccountId(acc.id || "")
  }

  async function getAuthUrl() {
    if (!selectedAccountId) return
    setAuthError("")
    try {
      const res = await accountsApi.getDriveAuthUrl(selectedAccountId)
      setAuthUrl(res.auth_url)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ""
      setAuthError(msg || "Gagal mengambil auth URL. Pastikan client_secrets.json tersedia di config/google_secrets atau root project.")
    }
  }

  async function connectDrive() {
    if (!selectedAccountId || !connectCode.trim()) return
    await accountsApi.connectDrive(selectedAccountId, connectCode.trim())
    const res = await accountsApi.getAccounts()
    const list = res.accounts.filter(a => a.platform === "google_drive")
    setAccounts(list)
  }

  return (
    <div className="px-[var(--section-px)] py-[var(--section-py)]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Google Drive Explorer</h1>
      </div>

      <Card className="p-[var(--card-p)] mb-4">
        {!hasDriveAccount ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Belum ada akun Google Drive. Buat akun dan sambungkan OAuth terlebih dahulu.</div>
            <div className="flex gap-2">
              <Input placeholder="Nama akun" value={newAccountName} onChange={e => setNewAccountName(e.target.value)} />
              <Button onClick={createDriveAccount}>Buat Akun</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedAccountId} onValueChange={v => setSelectedAccountId(String(v))}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Pilih akun" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={(a.id || "")}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={getAuthUrl}>Ambil Auth URL</Button>
            {authUrl ? (
              <a href={authUrl} target="_blank" rel="noreferrer" className="text-primary underline">Buka URL</a>
            ) : null}
            {authError ? <span className="text-sm text-error">{authError}</span> : null}
            <Input placeholder="Authorization code" value={connectCode} onChange={e => setConnectCode(e.target.value)} />
            <Button onClick={connectDrive}>Connect</Button>
          </div>
        )}
      </Card>

      {selectedAccountId ? (
        <Card className="p-[var(--card-p)]">
          <div className="flex items-center justify-between mb-4">
            <Breadcrumb>
              <BreadcrumbList>
                {pathStack.map((seg, idx) => (
                  <BreadcrumbItem key={seg.id ?? idx}>
                    {idx < pathStack.length - 1 ? (
                      <>
                        <BreadcrumbLink onClick={() => navigateBreadcrumb(idx)} className="cursor-pointer">{seg.name}</BreadcrumbLink>
                        <BreadcrumbSeparator />
                      </>
                    ) : (
                      <BreadcrumbPage>{seg.name}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            <div className="flex flex-col gap-3 w-full">
              <div className="flex flex-wrap items-center gap-2">
              <Input type="file" onChange={handleUpload} disabled={uploading} className="w-full md:w-auto" />
              {uploading ? (
                <div className="flex items-center gap-2 min-w-[160px]">
                  <Loader2 className="size-3 animate-spin text-primary" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Mengupload…</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-1.5" />
                  </div>
                </div>
              ) : null}
                <div className="flex gap-2 w-full md:w-auto">
                  <Input placeholder="Nama folder" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="w-full md:w-44" />
                <Button onClick={handleCreateFolder} disabled={creatingFolder} aria-label="Buat Folder">
                  {creatingFolder ? <Loader2 className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}
                  <span className="hidden md:inline ml-1.5">{creatingFolder ? "Membuat…" : "Buat Folder"}</span>
                  </Button>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                <Button variant="secondary" onClick={importSelectedToVideo} disabled={importing} aria-label="Import ke Video Project">
                  {importing ? <Loader2 className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
                  <span className="hidden md:inline ml-1.5">{importing ? "Memproses…" : "Import ke Video"}</span>
                  </Button>
                <Button variant="secondary" onClick={importSelectedToKdp} disabled={importing} aria-label="Import ke KDP Project">
                  {importing ? <Loader2 className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
                  <span className="hidden md:inline ml-1.5">{importing ? "Memproses…" : "Import ke KDP"}</span>
                  </Button>
                  {importing || importProgress > 0 ? (
                    <div className="flex items-center gap-2 min-w-[200px]">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Impor</span>
                          <span>{importProgress}%</span>
                        </div>
                        <Progress value={importProgress} className="h-1.5" />
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <Button variant="outline" onClick={selectAll} aria-label="Select All">
                    <CheckSquare className="size-4" />
                    <span className="hidden md:inline ml-1.5">Select All</span>
                  </Button>
                  <Button variant="outline" onClick={clearSelection} aria-label="Clear Selection">
                    <XCircle className="size-4" />
                    <span className="hidden md:inline ml-1.5">Clear</span>
                  </Button>
                </div>
                <div className="flex items-center gap-2 w-full md:ml-auto md:w-auto">
                  <Input placeholder="Go to folder (ID/URL)" value={gotoInput} onChange={e => setGotoInput(e.target.value)} className="w-full md:w-72" />
                  <Button onClick={gotoFolder} aria-label="Go">
                    <ArrowRight className="size-4" />
                    <span className="hidden md:inline ml-1.5">Go</span>
                  </Button>
                {lastUpdatedAt ? (
                  <span className="ml-auto text-[11px] text-muted-foreground/70">
                    Terakhir update: {new Date(lastUpdatedAt).toLocaleTimeString()}
                  </span>
                ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className="border border-[var(--border)] rounded">
            {!isConnected ? (
              <div className="p-4 text-sm text-muted-foreground">Akun belum tersambung. Ambil Auth URL, lakukan grant, lalu connect dengan authorization code.</div>
          ) : loading && files.length === 0 ? (
            <div className="divide-y divide-[var(--border)]">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded-sm bg-elevated" />
                    <Skeleton className="h-4 w-16 bg-elevated" />
                    <Skeleton className="h-4 w-40 bg-elevated" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded bg-elevated" />
                </div>
              ))}
            </div>
          ) : listStatus === "error" ? (
            <div className="p-4 text-sm rounded border border-red-500/30 bg-red-500/10 text-red-600">
              <div className="font-medium">Gagal memuat daftar file</div>
              {listError ? <div className="mt-1 text-xs opacity-70">Detail: {listError}</div> : null}
            </div>
            ) : files.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Tidak ada file</div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {files.map(f => (
                  <div key={f.id} className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-3">
                      <Checkbox checked={!!selectedIds[f.id]} onCheckedChange={(v) => toggleSelect(f.id, !!v)} />
                      <div className="text-sm">{f.mimeType === "application/vnd.google-apps.folder" ? "Folder" : "File"}</div>
                      <div className="font-medium">{f.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {f.mimeType === "application/vnd.google-apps.folder" ? (
                        <Button variant="secondary" onClick={() => navigateToFolder(f)}>Buka</Button>
                      ) : null}
                    <Button variant="destructive" onClick={() => handleDelete(f.id)} disabled={deletingId === f.id}>
                      {deletingId === f.id ? <Loader2 className="size-4 animate-spin" /> : null}
                      <span className="ml-1.5">Hapus</span>
                    </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <Input placeholder="Alias bookmark" value={bookmarkAlias} onChange={e => setBookmarkAlias(e.target.value)} />
              <Button variant="outline" onClick={addBookmark} disabled={!parentId}>Save Bookmark</Button>
            </div>
            {bookmarks.length > 0 ? (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {bookmarks.filter(b => b.accountId === selectedAccountId).map(b => (
                  <div key={`${b.alias}-${b.folderId}`} className="flex items-center justify-between px-3 py-2 border border-[var(--border)] rounded">
                    <div className="text-xs">
                      <div className="font-medium">{b.alias}</div>
                      <div className="text-muted-foreground">{b.folderId.slice(0,10)}…</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openBookmark(b)}>Open</Button>
                      <Button size="sm" variant="destructive" onClick={() => saveBookmarks(bookmarks.filter(x => x !== b))}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card className="p-[var(--card-p)]">
          <div className="text-sm text-muted-foreground">Pilih atau buat akun Google Drive terlebih dahulu.</div>
        </Card>
      )}
    </div>
  )
}
