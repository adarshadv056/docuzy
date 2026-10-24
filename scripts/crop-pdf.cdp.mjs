#!/usr/bin/env node
/**
 * Real-browser verification for /tools/crop-pdf.
 *
 * Drives Chromium through the Chrome DevTools Protocol with genuine
 * `Input.dispatchMouseEvent` drags (no synthetic React events), then inspects
 * the PDF the widget actually produces:
 *
 *   1. the seeded selection is visible (border + handles + dimmed surround)
 *   2. the selection overlay follows the pointer *mid-drag*
 *   3. the `se` handle resizes the selection live
 *   4. dragging inside the box moves it
 *   5. typed margins move the border (and the unit selector converts them)
 *   6. "Trim white margins" snaps the border onto the ink bounds
 *   7. the applied CropBox matches the dragged rect on an upright page
 *   8. the applied CropBox matches the dragged rect on a /Rotate 90 page
 *   9. resize mode still works end to end (the "resize suite")
 *
 * Usage:
 *   npm run build
 *   node scripts/crop-pdf.cdp.mjs            # starts `next start` itself
 *   node scripts/crop-pdf.cdp.mjs --url http://127.0.0.1:3000
 */

import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'

const APP_PORT = 3199
const CDP_PORT = 9333
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const args = process.argv.slice(2)
const urlArgIndex = args.indexOf('--url')
const baseUrl = urlArgIndex >= 0 ? args[urlArgIndex + 1] : `http://127.0.0.1:${APP_PORT}`

const results = []
let failures = 0

function check(name, ok, detail = '') {
  results.push({ name, ok })
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

function near(name, actual, expected, tolerance, unit = '') {
  const ok = Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance
  check(
    name,
    ok,
    `got ${Number(actual).toFixed(2)}${unit}, expected ${expected.toFixed(2)}${unit} ±${tolerance}`
  )
  return ok
}

function within(name, actual, min, max, unit = '') {
  const ok = Number.isFinite(actual) && actual >= min && actual <= max
  check(name, ok, `got ${Number(actual).toFixed(2)}${unit}, expected ${min}…${max}${unit}`)
  return ok
}

// --- tiny CDP client ---------------------------------------------------------

class Cdp {
  static async connect(wsUrl) {
    const socket = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
    return new Cdp(socket)
  }

  constructor(socket) {
    this.socket = socket
    this.nextId = 0
    this.pending = new Map()
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString())
      if (!message.id) return
      const entry = this.pending.get(message.id)
      if (!entry) return
      this.pending.delete(message.id)
      if (message.error) entry.reject(new Error(`${message.error.message} (${entry.method})`))
      else entry.resolve(message.result)
    })
  }

  send(method, params = {}, sessionId) {
    const id = (this.nextId += 1)
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method })
      this.socket.send(JSON.stringify({ id, method, params, sessionId }))
    })
  }

  close() {
    this.socket.close()
  }
}

// --- helpers -----------------------------------------------------------------

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)
  return candidates
}

async function findChrome() {
  for (const candidate of chromePath()) {
    try {
      await stat(candidate)
      return candidate
    } catch {
      // keep looking
    }
  }
  throw new Error('No Chrome/Edge binary found — set CHROME_PATH')
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // not up yet
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function makeTestPdf(path) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)

  // Page 1: upright A4 with a black frame inset 50pt — a clean ink bbox.
  const upright = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  upright.drawRectangle({
    x: 50,
    y: 50,
    width: PAGE_WIDTH - 100,
    height: PAGE_HEIGHT - 100,
    borderColor: rgb(0, 0, 0),
    borderWidth: 2,
  })
  upright.drawText('Crop me — upright page', { x: 110, y: 760, size: 18, font })

  // Page 2: same geometry, turned 90° — the visible axes are swapped.
  const rotated = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  rotated.setRotation(degrees(90))
  rotated.drawRectangle({
    x: 50,
    y: 50,
    width: PAGE_WIDTH - 100,
    height: PAGE_HEIGHT - 100,
    borderColor: rgb(0.7, 0, 0),
    borderWidth: 2,
  })
  rotated.drawText('Crop me — rotated page', { x: 110, y: 760, size: 18, font })

  await writeFile(path, await doc.save())
}

async function waitForDownload(dir) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    const files = (await readdir(dir).catch(() => [])).filter((file) => file.endsWith('.pdf'))
    if (files.length > 0) {
      const file = join(dir, files[0])
      const first = await stat(file)
      await sleep(250)
      const second = await stat(file)
      if (first.size > 0 && first.size === second.size) return file
    }
    await sleep(200)
  }
  throw new Error('Timed out waiting for the download')
}

// --- main --------------------------------------------------------------------

async function main() {
  const chrome = await findChrome()
  const tempRoot = await mkdtemp(join(tmpdir(), 'docuzy-crop-cdp-'))
  const downloadDir = join(tempRoot, 'downloads')
  const profileDir = join(tempRoot, 'profile')
  const pdfPath = join(tempRoot, 'crop-test.pdf')
  await mkdir(downloadDir, { recursive: true })
  await mkdir(profileDir, { recursive: true })
  await makeTestPdf(pdfPath)

  let server = null
  if (urlArgIndex < 0) {
    const startArgs = ['run', 'start', '--', '-p', String(APP_PORT)]
    server =
      process.platform === 'win32'
        ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm ${startArgs.join(' ')}`], {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          })
        : spawn('npm', startArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
    server.stdout.on('data', (chunk) => {
      if (process.env.CDP_VERBOSE) process.stdout.write(chunk)
    })
    server.stderr.on('data', (chunk) => {
      if (process.env.CDP_VERBOSE) process.stderr.write(chunk)
    })
    await waitForHttp(baseUrl, 120000)
  }

  const browser = spawn(
    chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1400,1200',
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true }
  )

  let cdp = null
  const cleanup = async () => {
    try {
      cdp?.close()
    } catch {}
    for (const child of [browser, server]) {
      if (!child) continue
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      } else {
        child.kill('SIGKILL')
      }
    }
    await sleep(400)
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {})
  }

  try {
    // Wait for the CDP endpoint and attach a flat page session.
    let version = null
    for (let attempt = 0; attempt < 120 && !version; attempt += 1) {
      try {
        version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json()
      } catch {
        await sleep(250)
      }
    }
    if (!version) throw new Error('Chrome DevTools endpoint never came up')

    cdp = await Cdp.connect(version.webSocketDebuggerUrl)
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
    const send = (method, params = {}) => cdp.send(method, params, sessionId)

    await send('Page.enable')
    await send('Runtime.enable')
    await send('DOM.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1400,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false,
    })

    await send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
    }).catch(() => send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir }))

    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? 'Evaluation failed')
      }
      return result.result.value
    }

    const waitFor = async (expression, timeoutMs = 30000) => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return true
        await sleep(100)
      }
      throw new Error(`Timed out waiting for: ${expression}`)
    }

    const settle = async () => {
      await evaluate(
        'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 40))))'
      )
    }

    const rectOf = (selector) =>
      evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }
      })()`)

    const mouse = (type, x, y, buttons) =>
      send('Input.dispatchMouseEvent', {
        type,
        x,
        y,
        button: type === 'mouseMoved' ? 'none' : 'left',
        buttons,
        clickCount: type === 'mouseMoved' ? 0 : 1,
        pointerType: 'mouse',
      })

    const dragBy = async (start, delta, steps = 12) => {
      await mouse('mousePressed', start.x, start.y, 1)
      for (let step = 1; step <= steps; step += 1) {
        await mouse('mouseMoved', start.x + (delta.x * step) / steps, start.y + (delta.y * step) / steps, 1)
        await settle()
      }
      await mouse('mouseReleased', start.x + delta.x, start.y + delta.y, 0)
      await settle()
    }

    const clickText = async (text, tag = 'button') => {
      const clicked = await evaluate(`(() => {
        const el = [...document.querySelectorAll(${JSON.stringify(tag)})]
          .find((node) => node.textContent.trim().includes(${JSON.stringify(text)}))
        if (!el) return false
        el.scrollIntoView({ block: 'center' })
        el.click()
        return true
      })()`)
      if (!clicked) throw new Error(`Could not click ${tag} containing "${text}"`)
      await settle()
    }

    const setInputValue = async (selector, value) => {
      const ok = await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) return false
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(el, ${JSON.stringify(String(value))})
        el.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      })()`)
      if (!ok) throw new Error(`Input not found: ${selector}`)
      await settle()
    }

    const labelInput = async (label) => {
      const selector = await evaluate(`(() => {
        const label = [...document.querySelectorAll('label')]
          .find((node) => node.textContent.trim() === ${JSON.stringify(label)})
        if (!label) return null
        const input = label.parentElement.querySelector('input')
        if (!input) return null
        input.dataset.test = 'margin-' + ${JSON.stringify(label.toLowerCase())}
        return '[data-test="margin-' + ${JSON.stringify(label.toLowerCase())} + '"]'
      })()`)
      if (!selector) throw new Error(`Margin input not found: ${label}`)
      return selector
    }

    const pageLoad = async () => {
      await send('Page.navigate', { url: `${baseUrl}/tools/crop-pdf` })
      await waitFor('document.readyState === "complete"')
      await waitFor('!!document.querySelector("input[type=file]")')
    }

    const upload = async () => {
      const { root } = await send('DOM.getDocument', { depth: -1 })
      const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' })
      if (!nodeId) throw new Error('File input not found')
      await send('DOM.setFileInputFiles', { nodeId, files: [pdfPath] })
      await waitFor('!!document.querySelector(".ReactCrop__crop-selection")', 60000)
      await waitFor('!!document.querySelector(".ReactCrop img") && document.querySelector(".ReactCrop img").complete')
      await settle()
    }

    /** Selection + image geometry and the page size the preview shows. */
    const selectionState = async () => {
      const state = await evaluate(`(() => {
        const img = document.querySelector('.ReactCrop img')
        const selection = document.querySelector('.ReactCrop__crop-selection')
        if (!img || !selection) return null
        const i = img.getBoundingClientRect()
        const s = selection.getBoundingClientRect()
        const text = document.querySelector('[data-page-info]')?.textContent
          ?? [...document.querySelectorAll('p')].map((p) => p.textContent).find((t) => t && t.startsWith('Page ')) ?? ''
        return {
          img: { x: i.x, y: i.y, width: i.width, height: i.height, right: i.right, bottom: i.bottom },
          selection: { x: s.x, y: s.y, width: s.width, height: s.height, right: s.right, bottom: s.bottom },
          pageInfo: text,
        }
      })()`)
      if (!state) throw new Error('Preview or selection is missing')
      return state
    }

    const unit = async () =>
      evaluate(`(() => {
        const select = document.querySelector('details select')
        return select ? select.value : null
      })()`)

    const openDetails = async () => {
      const open = await evaluate(`(() => {
        const details = document.querySelector('details')
        if (!details) return false
        if (!details.open) details.querySelector('summary').click()
        return true
      })()`)
      if (!open) throw new Error('The "Exact margins" disclosure is missing')
      await settle()
    }

    const waitForResult = async (heading) =>
      waitFor(
        `[...document.querySelectorAll('h3')].some((h) => h.textContent.includes(${JSON.stringify(heading)}))`,
        30000
      )

    const downloadAndLoad = async () => {
      await rm(downloadDir, { recursive: true, force: true })
      await mkdir(downloadDir, { recursive: true })
      await clickText('Download')
      const file = await waitForDownload(downloadDir)
      return PDFDocument.load(await readFile(file))
    }

    /** Expected user-space CropBox for the measured on-screen selection. */
    const expectedCropBox = (state, rotation) => {
      const { img, selection } = state
      const visible = rotation === 90 || rotation === 270
        ? { width: PAGE_HEIGHT, height: PAGE_WIDTH }
        : { width: PAGE_WIDTH, height: PAGE_HEIGHT }
      const left = ((selection.x - img.x) / img.width) * visible.width
      const top = ((selection.y - img.y) / img.height) * visible.height
      const width = (selection.width / img.width) * visible.width
      const height = (selection.height / img.height) * visible.height
      const bottom = visible.height - top - height

      // `displayToUser` maps display points into the page's *user space*, whose
      // box keeps its own width/height (a quarter turn only swaps what's seen).
      if (rotation === 90) {
        return { x: PAGE_WIDTH - bottom - height, y: left, width: height, height: width }
      }
      if (rotation === 270) {
        return { x: bottom, y: PAGE_HEIGHT - left - width, width: height, height: width }
      }
      if (rotation === 180) {
        return {
          x: visible.width - left - width,
          y: visible.height - bottom - height,
          width,
          height,
        }
      }
      return { x: left, y: bottom, width, height }
    }

    // --- load the tool and the test PDF --------------------------------------
    await pageLoad()
    await upload()

    // 1. the selection is seeded and visible (border, handles, dimmed surround)
    let state = await selectionState()
    near('seeded selection is inset 5% from the left', (state.selection.x - state.img.x) / state.img.width, 0.05, 0.01)
    near('seeded selection is inset 5% from the top', (state.selection.y - state.img.y) / state.img.height, 0.05, 0.01)
    near('seeded selection covers 90% of the width', state.selection.width / state.img.width, 0.9, 0.01)
    near('seeded selection covers 90% of the height', state.selection.height / state.img.height, 0.9, 0.01)
    check(
      'all 8 resize handles are rendered',
      (await evaluate('document.querySelectorAll(".ReactCrop__drag-handle").length')) === 8
    )
    check(
      'the surround is dimmed by the crop mask',
      await evaluate(
        '(() => { const m = document.querySelector(".ReactCrop__crop-mask"); return !!m && Number(m.getAttribute("width").replace("%","")) === 100 })()'
      )
    )

    // the live size badge must not create a dead zone on the selection
    const badge = await rectOf('.ReactCrop__selection-addon')
    check(
      'the selection shows a live size badge in the current unit',
      await evaluate(
        '(() => { const el = document.querySelector(".ReactCrop__selection-addon"); return !!el && /\\d/.test(el.textContent) && el.textContent.includes("mm") })()'
      )
    )
    const beforeBadgeDrag = await selectionState()
    await dragBy(
      { x: badge.x + badge.width / 2, y: badge.y + badge.height / 2 },
      { x: 12, y: 8 }
    )
    const afterBadgeDrag = await selectionState()
    near(
      'dragging from the size badge still moves the box (badge is pointer-transparent)',
      afterBadgeDrag.selection.x - beforeBadgeDrag.selection.x,
      12,
      2,
      'px'
    )

    // a stray click in the dimmed area must not wipe the selection
    const beforeOutsideClick = await selectionState()
    const outside = { x: beforeOutsideClick.img.x + 6, y: beforeOutsideClick.img.y + 6 }
    await mouse('mousePressed', outside.x, outside.y, 1)
    await mouse('mouseReleased', outside.x, outside.y, 0)
    await settle()
    const afterOutsideClick = await selectionState()
    near('a stray click outside keeps the selection (keepSelection)', afterOutsideClick.selection.x, beforeOutsideClick.selection.x, 0.5, 'px')
    near('a stray click outside keeps its width', afterOutsideClick.selection.width, beforeOutsideClick.selection.width, 0.5, 'px')
    state = await selectionState()

    // 2. the `se` handle resizes the selection live (mid-drag, before release)
    const seBefore = await rectOf('.ReactCrop__drag-handle.ord-se')
    const seStart = { x: seBefore.x + seBefore.width / 2, y: seBefore.y + seBefore.height / 2 }
    await mouse('mousePressed', seStart.x, seStart.y, 1)
    await mouse('mouseMoved', seStart.x - 30, seStart.y - 20, 1)
    await settle()
    const midResize = await selectionState()
    check(
      'the se handle resizes the selection mid-drag (before pointer-up)',
      midResize.selection.width < state.selection.width - 20 && midResize.selection.height < state.selection.height - 12,
      `width ${state.selection.width.toFixed(1)} → ${midResize.selection.width.toFixed(1)}px`
    )
    await mouse('mouseMoved', seStart.x - 120, seStart.y - 80, 1)
    await settle()
    await mouse('mouseReleased', seStart.x - 120, seStart.y - 80, 0)
    await settle()
    let resized = await selectionState()
    near('se resizing shrinks the width by the drag distance', state.selection.width - resized.selection.width, 120, 2, 'px')
    near('se resizing shrinks the height by the drag distance', state.selection.height - resized.selection.height, 80, 2, 'px')

    // 3. the overlay follows the pointer while dragging the box itself
    const boxStart = {
      x: resized.selection.x + resized.selection.width / 2,
      y: resized.selection.y + resized.selection.height / 2,
    }
    await mouse('mousePressed', boxStart.x, boxStart.y, 1)
    await mouse('mouseMoved', boxStart.x + 15, boxStart.y + 10, 1)
    await settle()
    const midMove = await selectionState()
    near('the overlay follows mid-drag (x)', midMove.selection.x - resized.selection.x, 15, 2, 'px')
    near('the overlay follows mid-drag (y)', midMove.selection.y - resized.selection.y, 10, 2, 'px')
    await mouse('mouseMoved', boxStart.x + 45, boxStart.y + 30, 1)
    await settle()
    await mouse('mouseReleased', boxStart.x + 45, boxStart.y + 30, 0)
    await settle()
    let moved = await selectionState()
    near('dragging inside moves the box (x)', moved.selection.x - resized.selection.x, 45, 2, 'px')
    near('dragging inside moves the box (y)', moved.selection.y - resized.selection.y, 30, 2, 'px')
    near('moving the box keeps its width', moved.selection.width, resized.selection.width, 1, 'px')
    near('moving the box keeps its height', moved.selection.height, resized.selection.height, 1, 'px')

    // 4. typed margins move the border (and stay synced with the unit)
    await openDetails()
    const leftInput = await labelInput('Left')
    check('the unit selector lives with the exact margins', (await unit()) === 'mm', `unit=${await unit()}`)
    await setInputValue(leftInput, 40)
    const typed = await selectionState()
    const leftExpected = moved.img.x + (40 * (72 / 25.4) * moved.img.width) / PAGE_WIDTH
    near('typing a 40 mm left margin moves the border there', typed.selection.x, leftExpected, 2, 'px')
    near('the opposite edge stays put when one margin is typed', typed.selection.right, moved.selection.right, 2, 'px')

    // switching the unit converts the same margin, it does not move the border
    await evaluate(`(() => {
      const select = document.querySelector('details select')
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
      setter.call(select, 'pt')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })()`)
    await settle()
    const leftValuePt = await evaluate(`Number(document.querySelector('[data-test="margin-left"]').value)`)
    near('the unit selector converts the typed margin to points', leftValuePt, (40 * 72) / 25.4, 0.2, 'pt')
    const afterUnit = await selectionState()
    near('changing the unit does not move the border', afterUnit.selection.x, typed.selection.x, 1, 'px')
    await evaluate(`(() => {
      const select = document.querySelector('details select')
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
      setter.call(select, 'mm')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })()`)
    await settle()

    // 5. "Trim white margins" snaps the border onto the ink bounds (50pt inset
    //    plus the 6px padding the tool leaves around the detected content)
    await clickText('Trim white margins')
    await waitFor(
      '![...document.querySelectorAll("button")].find((b) => b.textContent.includes("Trim white margins"))?.disabled',
      30000
    )
    await settle()
    const trimmed = await selectionState()
    const trimmedMargins = {
      left: ((trimmed.selection.x - trimmed.img.x) / trimmed.img.width) * PAGE_WIDTH,
      right: ((trimmed.img.right - trimmed.selection.right) / trimmed.img.width) * PAGE_WIDTH,
      top: ((trimmed.selection.y - trimmed.img.y) / trimmed.img.height) * PAGE_HEIGHT,
      bottom: ((trimmed.img.bottom - trimmed.selection.bottom) / trimmed.img.height) * PAGE_HEIGHT,
    }
    within('trim snaps the left margin to the ink bounds', trimmedMargins.left, 40, 48, 'pt')
    within('trim snaps the right margin to the ink bounds', trimmedMargins.right, 40, 48, 'pt')
    within('trim snaps the top margin to the ink bounds', trimmedMargins.top, 40, 48, 'pt')
    within('trim snaps the bottom margin to the ink bounds', trimmedMargins.bottom, 40, 48, 'pt')
    check(
      'the selection followed the trimmed border',
      Math.abs(trimmed.selection.width - moved.selection.width) > 20,
      `width ${moved.selection.width.toFixed(1)} → ${trimmed.selection.width.toFixed(1)}px`
    )

    // 6. apply on the upright page — the CropBox must match the dragged rect
    await clickText('Page range')
    const fromInput = await labelInput('From')
    const toInput = await labelInput('To')
    await setInputValue(fromInput, 1)
    await setInputValue(toInput, 1)
    check(
      'Apply is enabled for a valid selection',
      await evaluate(
        '[...document.querySelectorAll("button")].some((b) => b.textContent.includes("Crop PDF") && !b.disabled)'
      )
    )
    const uprightState = await selectionState()
    await clickText('Crop PDF')
    await waitForResult('Your PDF is cropped')
    const uprightDoc = await downloadAndLoad()
    const uprightPage = uprightDoc.getPage(0)
    const uprightCrop = uprightPage.getCropBox()
    const uprightMedia = uprightPage.getMediaBox()
    const uprightExpected = expectedCropBox(uprightState, 0)
    near('upright CropBox x matches the dragged rect', uprightCrop.x, uprightExpected.x, 2, 'pt')
    near('upright CropBox y matches the dragged rect', uprightCrop.y, uprightExpected.y, 2, 'pt')
    near('upright CropBox width matches the dragged rect', uprightCrop.width, uprightExpected.width, 2, 'pt')
    near('upright CropBox height matches the dragged rect', uprightCrop.height, uprightExpected.height, 2, 'pt')
    near('upright MediaBox follows the CropBox', uprightMedia.width, uprightCrop.width, 0.01, 'pt')
    near('upright MediaBox follows the CropBox (height)', uprightMedia.height, uprightCrop.height, 0.01, 'pt')
    check(
      'the upright crop keeps the untouched page 2 full size',
      Math.abs(uprightDoc.getPage(1).getCropBox().width - PAGE_WIDTH) < 0.01
    )

    // 7. same drag on the /Rotate 90 page — the CropBox is mapped into page space
    await clickText('Back to editing')
    const pageOneSrc = await evaluate('document.querySelector(".ReactCrop img").src')
    await evaluate('document.querySelector(\'button[aria-label="Next page"]\').click()')
    await waitFor(
      `document.querySelector(".ReactCrop img") && document.querySelector(".ReactCrop img").src !== ${JSON.stringify(pageOneSrc)}`,
      30000
    )
    await settle()
    await settle()
    const rotatedSeeded = await selectionState()
    near('the rotated page re-seeds a visible selection', rotatedSeeded.selection.width / rotatedSeeded.img.width, 0.9, 0.01)
    const rotatedSe = await rectOf('.ReactCrop__drag-handle.ord-se')
    await dragBy(
      { x: rotatedSe.x + rotatedSe.width / 2, y: rotatedSe.y + rotatedSe.height / 2 },
      { x: -90, y: -60 }
    )
    const rangeFrom = await labelInput('From')
    const rangeTo = await labelInput('To')
    await setInputValue(rangeFrom, 2)
    await setInputValue(rangeTo, 2)
    const rotatedState = await selectionState()
    await clickText('Crop PDF')
    await waitForResult('Your PDF is cropped')
    const rotatedDoc = await downloadAndLoad()
    const rotatedPage = rotatedDoc.getPage(1)
    const rotatedCrop = rotatedPage.getCropBox()
    const rotatedExpected = expectedCropBox(rotatedState, 90)
    near('rotated CropBox x matches the dragged rect', rotatedCrop.x, rotatedExpected.x, 2, 'pt')
    near('rotated CropBox y matches the dragged rect', rotatedCrop.y, rotatedExpected.y, 2, 'pt')
    near('rotated CropBox width matches the dragged rect', rotatedCrop.width, rotatedExpected.width, 2, 'pt')
    near('rotated CropBox height matches the dragged rect', rotatedCrop.height, rotatedExpected.height, 2, 'pt')
    check(
      'the rotated crop leaves the upright page untouched',
      Math.abs(rotatedDoc.getPage(0).getCropBox().width - PAGE_WIDTH) < 0.01
    )
    check(
      'the rotated page keeps its /Rotate 90',
      rotatedPage.getRotation().angle === 90,
      `angle=${rotatedPage.getRotation().angle}`
    )

    // 8. resize mode still works end to end (A5 landscape, all pages)
    await clickText('Back to editing')
    await clickText('Resize')
    await clickText('A5')
    await clickText('Landscape')
    await clickText('All pages')
    await settle()
    await waitFor(
      '[...document.querySelectorAll("button")].some((b) => b.textContent.includes("Resize PDF") && !b.disabled)'
    )
    await clickText('Resize PDF')
    await waitForResult('Your PDF is resized')
    const resizedDoc = await downloadAndLoad()
    const targetWidth = 595.28
    const targetHeight = 419.53
    const sizes = resizedDoc.getPages().map((page) => {
      const size = page.getSize()
      const angle = ((page.getRotation().angle % 360) + 360) % 360
      const quarter = angle === 90 || angle === 270
      return {
        displayWidth: quarter ? size.height : size.width,
        displayHeight: quarter ? size.width : size.height,
      }
    })
    near('resize: upright page is A5 landscape wide', sizes[0].displayWidth, targetWidth, 0.5, 'pt')
    near('resize: upright page is A5 landscape tall', sizes[0].displayHeight, targetHeight, 0.5, 'pt')
    near('resize: rotated page is A5 landscape wide', sizes[1].displayWidth, targetWidth, 0.5, 'pt')
    near('resize: rotated page is A5 landscape tall', sizes[1].displayHeight, targetHeight, 0.5, 'pt')
  } finally {
    await cleanup()
  }

  console.log(`\n${results.length - failures}/${results.length} checks passed`)
  if (failures > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(`\nFATAL: ${error.stack ?? error.message}`)
  process.exitCode = 1
})
