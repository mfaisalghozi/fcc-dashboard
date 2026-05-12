<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  bundle: [files: File[]]
}>()

const dragOver = ref(false)
const inputRef = ref<HTMLInputElement>()

function groupFilesByUTR(files: File[]): File[][] {
  const result: File[][] = []
  const ungrouped: File[] = []

  // Pass 1 — standard UTR-YYYY-NNNNNN naming convention
  const standardGroups = new Map<string, File[]>()
  for (const file of files) {
    const match = file.name.match(/UTR[-_](\d{4})[-_]?(\d+)/i)
    if (match) {
      const key = `${match[1]}-${match[2]}`
      if (!standardGroups.has(key)) standardGroups.set(key, [])
      standardGroups.get(key)!.push(file)
    } else {
      ungrouped.push(file)
    }
  }
  result.push(...standardGroups.values())

  if (ungrouped.length === 0) return result

  // Pass 2 — non-standard naming (e.g. 20.RISK_NOTES.UTR.III.2026):
  // group xlsx/pdf files with the docx whose base name is a substring of theirs
  const docxFiles = ungrouped.filter((f) => f.name.toLowerCase().endsWith('.docx'))
  const otherFiles = ungrouped.filter((f) => !f.name.toLowerCase().endsWith('.docx'))
  const matched = new Set<File>()

  for (const docx of docxFiles) {
    const base = docx.name.replace(/\.docx$/i, '').replace(/\s*\(\d+\)$/, '')
    const related = otherFiles.filter((f) => f.name.includes(base))
    related.forEach((f) => matched.add(f))
    result.push([docx, ...related])
  }

  // Any files with no matching docx go into their own group
  const unmatched = otherFiles.filter((f) => !matched.has(f))
  if (unmatched.length > 0) result.push(unmatched)

  return result
}

function handleFiles(files: File[]) {
  if (files.length === 0) return
  const bundles = groupFilesByUTR(files)
  for (const bundle of bundles) {
    emit('bundle', bundle)
  }
}

async function readEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file((f) => resolve([f]), () => resolve([]))
    })
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    return new Promise((resolve) => {
      reader.readEntries(async (entries) => {
        const nested = await Promise.all(entries.map(readEntry))
        resolve(nested.flat())
      }, () => resolve([]))
    })
  }
  return []
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false

  const items = e.dataTransfer?.items
  if (items && items.length > 0) {
    const entries = Array.from(items)
      .map((item) => item.webkitGetAsEntry())
      .filter((entry): entry is FileSystemEntry => entry !== null)
    const nested = await Promise.all(entries.map(readEntry))
    handleFiles(nested.flat())
    return
  }

  handleFiles(Array.from(e.dataTransfer?.files ?? []))
}

function onInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  handleFiles(Array.from(target.files ?? []))
  target.value = ''
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ 'is-drag': dragOver }"
    @dragenter.prevent="dragOver = true"
    @dragover.prevent="dragOver = true"
    @dragleave.prevent="dragOver = false"
    @drop="onDrop"
    @click="inputRef?.click()"
  >
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 3v12m0-12l-4 4m4-4l4 4" />
      <path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" />
    </svg>
    <p class="title">Drop UTR bundle here or click to upload</p>
    <p class="sub">Analysis (.docx) + working paper (.xlsx) + profile (optional)</p>
    <div class="types">
      <span class="ft">.docx</span>
      <span class="ft">.xlsx</span>
      <span class="ft">.pdf</span>
    </div>
    <input
      ref="inputRef"
      type="file"
      multiple
      accept=".docx,.xlsx,.pdf"
      hidden
      @change="onInputChange"
    />
  </div>
</template>

<style scoped>
.dropzone {
  border: 1.5px dashed #c2c0b6;
  border-radius: 8px;
  padding: 32px 16px;
  text-align: center;
  background: #f7f6f3;
  cursor: pointer;
  transition: all 0.15s;
}
.dropzone:hover,
.dropzone.is-drag {
  border-color: #185fa5;
  background: #e6f1fb;
}
.icon {
  width: 36px;
  height: 36px;
  margin: 0 auto 8px;
  color: #888780;
}
.title {
  font-size: 13px;
  font-weight: 500;
  color: #2c2c2a;
  margin: 0 0 4px;
}
.sub {
  font-size: 12px;
  color: #5f5e5a;
  margin: 0;
}
.types {
  margin-top: 16px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}
.ft {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  background: white;
  color: #5f5e5a;
  border: 0.5px solid #d3d1c7;
}
</style>
