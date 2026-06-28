import { useState } from "react"
import { open, save } from "@tauri-apps/plugin-dialog"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { FolderOpen, Play, Loader2, FileDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PointCloudViewer } from "@/components/PointCloudViewer"

interface PointCloudPreview {
  positions: number[]
  colors: number[]
  count: number
  total: number
  has_rgb: boolean
}

const OPERATIONS = [
  { value: "splat-to-sketchfab", label: "Splat → Sketchfab" },
] as const

type Operation = (typeof OPERATIONS)[number]["value"]

function deriveOutputName(inputPath: string, op: Operation): string {
  const filename = inputPath.replace(/\\/g, "/").split("/").pop() ?? "output"
  const stem = filename.replace(/\.ply$/i, "")
  if (op === "splat-to-sketchfab") return `${stem}_sketchfab.ply`
  return `${stem}_out.ply`
}

export default function App() {
  const [inputPath, setInputPath] = useState<string | null>(null)
  const [outputName, setOutputName] = useState("")
  const [operation, setOperation] = useState<Operation>("splat-to-sketchfab")
  const [preview, setPreview] = useState<PointCloudPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)

  async function handleLoad() {
    const selected = await open({
      title: "Open PLY file",
      filters: [{ name: "Point Cloud", extensions: ["ply"] }],
    })
    if (!selected) return
    const path = typeof selected === "string" ? selected : selected[0]
    setInputPath(path)
    setOutputName(deriveOutputName(path, operation))
    setLoading(true)
    setPreview(null)
    // Yield to the browser so React can commit the spinner before the invoke blocks
    await new Promise((r) => setTimeout(r, 0))
    try {
      const result = await invoke<PointCloudPreview>("read_ply_preview", { path })
      setPreview(result)
    } catch (err) {
      toast.error("Failed to load file", { description: String(err) })
    } finally {
      setLoading(false)
    }
  }

  async function handleRun() {
    if (!inputPath) return
    const outputPath = await save({
      title: "Save output as",
      defaultPath: outputName,
      filters: [{ name: "Point Cloud", extensions: ["ply"] }],
    })
    if (!outputPath) return
    setRunning(true)
    await new Promise((r) => setTimeout(r, 0))
    try {
      const msg = await invoke<string>("splat_to_sketchfab", {
        inputPath,
        outputPath,
      })
      toast.success("Done", { description: msg })
    } catch (err) {
      toast.error("Operation failed", { description: String(err) })
    } finally {
      setRunning(false)
    }
  }

  function handleOperationChange(val: Operation) {
    setOperation(val)
    if (inputPath) setOutputName(deriveOutputName(inputPath, val))
  }

  const filename = inputPath?.replace(/\\/g, "/").split("/").pop()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Toaster richColors position="bottom-right" />

      {/* Left panel — file */}
      <aside className="flex w-64 shrink-0 flex-col gap-4 border-r p-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          File
        </h2>
        <Button variant="outline" className="w-full justify-start gap-2" onClick={handleLoad}>
          <FolderOpen className="h-4 w-4" />
          Load PLY
        </Button>

        {filename && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            <p className="truncate font-mono font-medium" title={filename}>
              {filename}
            </p>
            {preview && (
              <p className="mt-1 text-muted-foreground">
                {preview.count.toLocaleString()} pts shown
                {preview.total !== preview.count && (
                  <> of {preview.total.toLocaleString()}</>
                )}
              </p>
            )}
            {loading && (
              <p className="mt-1 flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </p>
            )}
          </div>
        )}
      </aside>

      <Separator orientation="vertical" />

      {/* Centre panel — operation */}
      <aside className="flex w-72 shrink-0 flex-col gap-5 border-r p-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Operation
        </h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="op-select">Operation</Label>
          <Select value={operation} onValueChange={handleOperationChange}>
            <SelectTrigger id="op-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATIONS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="output-name">Output filename</Label>
          <div className="flex items-center gap-1">
            <FileDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              id="output-name"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              placeholder="output.ply"
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div className="mt-auto">
          <Button
            className="w-full gap-2"
            disabled={!inputPath || running}
            onClick={handleRun}
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {running ? "Running…" : "Run"}
          </Button>
        </div>
      </aside>

      <Separator orientation="vertical" />

      {/* Right panel — preview */}
      <main className="min-w-0 flex-1">
        <PointCloudViewer
          positions={preview?.positions ?? null}
          colors={preview?.has_rgb ? (preview.colors ?? null) : null}
        />
      </main>
    </div>
  )
}
