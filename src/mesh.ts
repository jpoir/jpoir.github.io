/**
 * Three.js wireframe mesh background — reactive to mouse.
 * Returns a cleanup function.
 */
import * as THREE from 'three'

export function initMesh(canvas: HTMLCanvasElement): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(0, 0, 4)

  const SEG = 80
  const geometry = new THREE.PlaneGeometry(14, 14, SEG, SEG)
  const posAttr = geometry.attributes['position'] as THREE.BufferAttribute

  const originalY = new Float32Array(posAttr.count)
  for (let i = 0; i < posAttr.count; i++) originalY[i] = posAttr.getY(i)

  const material = new THREE.MeshBasicMaterial({
    color: 0xb44fff,
    wireframe: true,
    transparent: true,
    opacity: 0.18,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 3.5
  mesh.position.y = -1.5
  scene.add(mesh)

  // Raycaster for accurate mouse-to-mesh-plane intersection
  const raycaster  = new THREE.Raycaster()
  const mouseNDC   = new THREE.Vector2(9999, 9999)
  const meshLocal  = new THREE.Vector2(9999, 9999)   // mouse in mesh local space

  // The mesh's resting plane: normal is (0,0,1) rotated by mesh.rotation
  const planeNormal = new THREE.Vector3(0, 0, 1).applyEuler(mesh.rotation)
  const meshPlane   = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, mesh.position)
  const intersectPt = new THREE.Vector3()

  function updateMouseLocal() {
    raycaster.setFromCamera(mouseNDC, camera)
    if (raycaster.ray.intersectPlane(meshPlane, intersectPt)) {
      const local = mesh.worldToLocal(intersectPt.clone())
      meshLocal.set(local.x, local.y)
    }
  }

  function onMouseMove(e: MouseEvent) {
    mouseNDC.x =  (e.clientX / window.innerWidth)  * 2 - 1
    mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1
  }
  function onTouchMove(e: TouchEvent) {
    const t = e.touches[0]!
    mouseNDC.x =  (t.clientX / window.innerWidth)  * 2 - 1
    mouseNDC.y = -(t.clientY / window.innerHeight) * 2 + 1
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('touchmove', onTouchMove, { passive: true })

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', onResize)
  onResize()

  const clock = new THREE.Clock()
  let rafId: number

  function animate() {
    rafId = requestAnimationFrame(animate)
    updateMouseLocal()
    const t  = clock.getElapsedTime()
    const mx = meshLocal.x
    const my = meshLocal.y

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i)
      const y = originalY[i]!
      const dx = x - mx
      const dy = y - my
      const dist = Math.sqrt(dx * dx + dy * dy)
      const ripple = Math.sin(dist * 1.2 - t * 3) * Math.exp(-dist * 0.35) * 0.55
      const wave = Math.sin(x * 0.4 + t * 0.6) * 0.12 + Math.cos(y * 0.5 + t * 0.4) * 0.1
      posAttr.setZ(i, ripple + wave)
    }

    posAttr.needsUpdate = true
    geometry.computeVertexNormals()
    renderer.render(scene, camera)
  }

  animate()

  return () => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('resize', onResize)
    geometry.dispose()
    material.dispose()
    renderer.dispose()
  }
}
