<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  bundle: [files: File[]]
}>()

const dragOver = ref(false)
const inputRef = ref<HTMLInputElement>()

function groupFilesByUTR(files: File[]): File[][] {
  const groups = new Map<string, File[]>()

  for (const file of files) {
    const match = file.name.match(/UTR[-_](\d{4})[-_]?(\d+)/i)
    const key = match ? `${match[1]}-${match[2]}` : file.name.split('.')[0]
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(file)
  }

  return Array.from(groups.values())
}

function handleFiles(fileList: FileList | null) {
  if (!fileList || fileList.length === 0) return
  const files = Array.from(fileList)
  const bundles = groupFilesByUTR(files)
  for (const bundle of bundles) {
    emit('bundle', bundle)
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  handleFiles(e.dataTransfer?.files ?? null)
}

function onInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  handleFiles(target.files)
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
