import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"

interface Props {
  positions: number[] | null
  colors: number[] | null
  flipped: boolean
  pointSizeMultiplier: number
}

export function PointCloudViewer({ positions, colors, flipped, pointSizeMultiplier }: Props) {
  const { t } = useTranslation()
  const mountRef = useRef<HTMLDivElement>(null)
  const pointsRef = useRef<THREE.Points | null>(null)
  const baseSizeRef = useRef<number>(0.01)
  const materialRef = useRef<THREE.PointsMaterial | null>(null)

  // Main scene effect — rebuild when data changes
  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !positions || positions.length === 0) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a0a)

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.001, 10000)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05

    const posArray = new Float32Array(positions)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(posArray, 3))

    const hasColors = colors && colors.length === positions.length
    if (hasColors) {
      geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors!), 3))
    }

    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const center = new THREE.Vector3()
    box.getCenter(center)
    geometry.translate(-center.x, -center.y, -center.z)

    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)

    const baseSize = maxDim / 800
    baseSizeRef.current = baseSize

    const material = new THREE.PointsMaterial({
      size: baseSize * pointSizeMultiplier,
      sizeAttenuation: true,
      vertexColors: !!hasColors,
      ...(hasColors ? {} : { color: 0x888888 }),
    })
    materialRef.current = material

    const points = new THREE.Points(geometry, material)
    points.rotation.x = flipped ? Math.PI : 0
    scene.add(points)
    pointsRef.current = points

    camera.position.set(0, 0, maxDim * 1.5)
    controls.target.set(0, 0, 0)
    controls.update()

    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    return () => {
      pointsRef.current = null
      materialRef.current = null
      cancelAnimationFrame(animId)
      ro.disconnect()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
      renderer.dispose()
      geometry.dispose()
      material.dispose()
    }
  }, [positions, colors]) // eslint-disable-line react-hooks/exhaustive-deps

  // Flip effect — apply rotation imperatively without rebuilding the scene
  useEffect(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.x = flipped ? Math.PI : 0
    }
  }, [flipped])

  // Point size effect — update material imperatively
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.size = baseSizeRef.current * pointSizeMultiplier
      materialRef.current.needsUpdate = true
    }
  }, [pointSizeMultiplier])

  return (
    <div ref={mountRef} className="relative h-full w-full">
      {!positions && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {t("preview.emptyState")}
        </div>
      )}
    </div>
  )
}
