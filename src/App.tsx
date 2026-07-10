import { useRef, useState } from "react"
import { open, save } from "@tauri-apps/plugin-dialog"
import { invoke } from "@tauri-apps/api/core"
import { join } from "@tauri-apps/api/path"
import { toast } from "sonner"
import { FolderOpen, Play, Loader2, FileDown, FlipVertical2, Files } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Toaster } from "@/components/ui/sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PointCloudViewer } from "@/components/PointCloudViewer"

interface PropertyInfo {
  name: string
  type_name: string
}

interface PointCloudPreview {
  positions: number[]
  colors: number[]
  count: number
  total: number
  has_rgb: boolean
  properties: PropertyInfo[]
}

const OPERATIONS = [
  { value: "splat-to-sketchfab", label: "Splat → Sketchfab" },
  { value: "mip-splat-fuse", label: "Mip-Splat Fuse" },
] as const

type Operation = (typeof OPERATIONS)[number]["value"]

const OPERATION_COMMANDS: Record<Operation, string> = {
  "splat-to-sketchfab": "splat_to_sketchfab",
  "mip-splat-fuse": "mip_splat_fuse",
}

function deriveOutputName(inputPath: string, op: Operation): string {
  const filename = inputPath.replace(/\\/g, "/").split("/").pop() ?? "ausgabe"
  const stem = filename.replace(/\.ply$/i, "")
  if (op === "splat-to-sketchfab") return `${stem}_sketchfab.ply`
  if (op === "mip-splat-fuse") return `${stem}_fused.ply`
  return `${stem}_ausgabe.ply`
}

// Drag handle between panels
function ResizeHandle({ onDelta }: { onDelta: (delta: number) => void }) {
  const startX = useRef(0)
  return (
    <div
      className="w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/40 active:bg-primary/60"
      onPointerDown={(e) => {
        startX.current = e.clientX
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        onDelta(e.clientX - startX.current)
        startX.current = e.clientX
      }}
      onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
    />
  )
}

export default function App() {
  const [inputPath, setInputPath] = useState<string | null>(null)
  const [batchPaths, setBatchPaths] = useState<string[]>([])
  const [outputName, setOutputName] = useState("")
  const [operation, setOperation] = useState<Operation>("splat-to-sketchfab")
  const [preview, setPreview] = useState<PointCloudPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [pointSizeMultiplier, setPointSizeMultiplier] = useState(1)

  // Panel widths
  const [leftWidth, setLeftWidth] = useState(256)
  const [midWidth, setMidWidth] = useState(288)

  const isBatch = batchPaths.length > 1

  async function handleLoad() {
    const selected = await open({
      title: "PLY-Datei(en) öffnen",
      multiple: true,
      filters: [{ name: "Punktwolke", extensions: ["ply"] }],
    })
    if (!selected) return
    const paths = Array.isArray(selected) ? selected : [selected]

    if (paths.length > 1) {
      setBatchPaths(paths)
      setInputPath(null)
      setPreview(null)
      setOutputName("")
      return
    }

    const path = paths[0]
    setBatchPaths([])
    setInputPath(path)
    setOutputName(deriveOutputName(path, operation))
    setLoading(true)
    setPreview(null)
    await new Promise((r) => setTimeout(r, 0))
    try {
      const result = await invoke<PointCloudPreview>("read_ply_preview", { path })
      setPreview(result)
    } catch (err) {
      toast.error("Fehler beim Laden", { description: String(err) })
    } finally {
      setLoading(false)
    }
  }

  async function handleRun() {
    if (!inputPath) return
    const outputPath = await save({
      title: "Ausgabe speichern unter",
      defaultPath: outputName,
      filters: [{ name: "Punktwolke", extensions: ["ply"] }],
    })
    if (!outputPath) return
    setRunning(true)
    await new Promise((r) => setTimeout(r, 0))
    try {
      const msg = await invoke<string>(OPERATION_COMMANDS[operation], {
        inputPath,
        outputPath,
      })
      toast.success("Fertig", { description: msg })
    } catch (err) {
      toast.error("Fehler", { description: String(err) })
    } finally {
      setRunning(false)
    }
  }

  async function handleRunBatch() {
    if (batchPaths.length === 0) return
    const outDir = await open({
      title: "Ausgabeordner wählen",
      directory: true,
    })
    if (!outDir || typeof outDir !== "string") return

    setRunning(true)
    await new Promise((r) => setTimeout(r, 0))
    let succeeded = 0
    const failures: string[] = []
    for (const path of batchPaths) {
      const filename = path.replace(/\\/g, "/").split("/").pop() ?? path
      try {
        const outputPath = await join(outDir, deriveOutputName(path, operation))
        await invoke<string>(OPERATION_COMMANDS[operation], { inputPath: path, outputPath })
        succeeded++
      } catch (err) {
        failures.push(`${filename}: ${String(err)}`)
      }
    }
    setRunning(false)

    if (failures.length === 0) {
      toast.success("Batch fertig", {
        description: `${succeeded} Datei(en) verarbeitet`,
      })
    } else {
      toast.error("Batch teilweise fehlgeschlagen", {
        description: `${succeeded} erfolgreich, ${failures.length} fehlgeschlagen: ${failures.join("; ")}`,
      })
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

      {/* Linke Spalte — Datei */}
      <aside
        className="flex shrink-0 flex-col gap-4 overflow-hidden p-4"
        style={{ width: leftWidth }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Datei
        </h2>
        <Button variant="outline" className="w-full justify-start gap-2" onClick={handleLoad}>
          <FolderOpen className="h-4 w-4" />
          PLY laden
        </Button>

        {isBatch && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            <p className="flex items-center gap-1 font-medium">
              <Files className="h-3.5 w-3.5" />
              {batchPaths.length} Dateien ausgewählt
            </p>
            <div className="mt-1 max-h-40 overflow-y-auto">
              {batchPaths.map((p) => {
                const name = p.replace(/\\/g, "/").split("/").pop() ?? p
                return (
                  <p key={p} className="truncate font-mono text-muted-foreground" title={p}>
                    {name}
                  </p>
                )
              })}
            </div>
          </div>
        )}

        {filename && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            <p className="truncate font-mono font-medium" title={filename}>
              {filename}
            </p>
            {preview && (
              <p className="mt-1 text-muted-foreground">
                {preview.count.toLocaleString("de")} Punkte angezeigt
                {preview.total !== preview.count && (
                  <> von {preview.total.toLocaleString("de")}</>
                )}
              </p>
            )}
            {loading && (
              <p className="mt-1 flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Lädt…
              </p>
            )}
          </div>
        )}

        {preview && preview.properties.length > 0 && (
          <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
            <p className="text-xs font-semibold text-muted-foreground">
              Eigenschaften ({preview.properties.length})
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
              <table className="w-full text-xs">
                <tbody>
                  {preview.properties.map((p) => (
                    <tr key={p.name} className="border-b last:border-0">
                      <td className="max-w-0 truncate px-2 py-0.5 font-mono" title={p.name}>
                        {p.name}
                      </td>
                      <td className="whitespace-nowrap px-2 py-0.5 text-right text-muted-foreground">
                        {p.type_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </aside>

      <ResizeHandle onDelta={(d) => setLeftWidth((w) => Math.min(480, Math.max(160, w + d)))} />

      {/* Mittlere Spalte — Operation */}
      <aside
        className="flex shrink-0 flex-col gap-5 p-4"
        style={{ width: midWidth }}
      >
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

        {isBatch ? (
          <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            Ausgabedateien werden automatisch benannt (z. B. <span className="font-mono">…_{operation === "mip-splat-fuse" ? "fused" : "sketchfab"}.ply</span>)
            und beim Ausführen in einen gewählten Ordner geschrieben.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="output-name">Ausgabedatei</Label>
            <div className="flex items-center gap-1">
              <FileDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                id="output-name"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="ausgabe.ply"
                className="font-mono text-xs"
              />
            </div>
          </div>
        )}

        <div className="mt-auto">
          <Button
            className="w-full gap-2"
            disabled={(!inputPath && !isBatch) || running}
            onClick={isBatch ? handleRunBatch : handleRun}
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {running
              ? "Läuft…"
              : isBatch
                ? `Batch ausführen (${batchPaths.length})`
                : "Ausführen"}
          </Button>
        </div>
      </aside>

      <ResizeHandle onDelta={(d) => setMidWidth((w) => Math.min(480, Math.max(200, w + d)))} />

      {/* Rechte Spalte — Vorschau */}
      <main className="relative min-w-0 flex-1">
        {isBatch ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Keine Vorschau im Batch-Modus — {batchPaths.length} Dateien werden verarbeitet.
          </div>
        ) : (
          <PointCloudViewer
            positions={preview?.positions ?? null}
            colors={preview?.has_rgb ? (preview.colors ?? null) : null}
            flipped={flipped}
            pointSizeMultiplier={pointSizeMultiplier}
          />
        )}
        {!isBatch && preview && (
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <Slider
              min={0.25}
              max={20}
              step={0.05}
              value={[pointSizeMultiplier]}
              onValueChange={([v]) => setPointSizeMultiplier(v)}
              className="w-24"
            />
            <Button
              variant={flipped ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              title="Vorschau umdrehen"
              onClick={() => setFlipped((f) => !f)}
            >
              <FlipVertical2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
