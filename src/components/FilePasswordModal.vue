<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  lockedFiles: string[]
}>()

const emit = defineEmits<{
  submit: [passwords: Record<string, string>]
  cancel: []
}>()

const samePassword = ref(false)
const sharedPassword = ref('')
const perFilePasswords = ref<Record<string, string>>(
  Object.fromEntries(props.lockedFiles.map((f) => [f, '']))
)

function handleSubmit() {
  const passwords: Record<string, string> = {}
  if (samePassword.value) {
    for (const file of props.lockedFiles) {
      passwords[file] = sharedPassword.value
    }
  } else {
    Object.assign(passwords, perFilePasswords.value)
  }
  emit('submit', passwords)
}

// ---------------------------------------------------------------------------
// Keyboard handler
// ---------------------------------------------------------------------------
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('cancel')
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      class="overlay"
      @click.self="emit('cancel')"
      role="dialog"
      aria-modal="true"
      aria-label="Enter password for locked files"
    >
      <div class="modal">
        <div class="modal-header">
          <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div>
            <h2 class="modal-title">Files require a password</h2>
            <p class="modal-sub">{{ lockedFiles.length }} file(s) could not be opened</p>
          </div>
        </div>

        <label class="checkbox-row">
          <input type="checkbox" v-model="samePassword" />
          <span>All files share the same password</span>
        </label>

        <div v-if="samePassword" class="field">
          <label class="field-label">Password</label>
          <input
            class="field-input"
            type="password"
            v-model="sharedPassword"
            placeholder="Enter password"
            autofocus
          />
        </div>

        <div v-else class="fields">
          <div v-for="file in lockedFiles" :key="file" class="field">
            <label class="field-label">{{ file }}</label>
            <input
              class="field-input"
              type="password"
              v-model="perFilePasswords[file]"
              placeholder="Enter password"
            />
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="emit('cancel')">Cancel</button>
          <button class="btn-submit" @click="handleSubmit">Unlock &amp; Retry</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(44, 44, 42, 0.45);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 420px;
  max-width: calc(100vw - 32px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
}
.modal-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.lock-icon {
  width: 24px;
  height: 24px;
  color: #185fa5;
  flex-shrink: 0;
  margin-top: 2px;
}
.modal-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
  color: #2c2c2a;
}
.modal-sub {
  font-size: 13px;
  color: #5f5e5a;
  margin: 4px 0 0;
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #2c2c2a;
  cursor: pointer;
}
.fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field-label {
  font-size: 12px;
  color: #5f5e5a;
  font-family: 'Courier New', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.field-input {
  padding: 8px 10px;
  border: 1px solid #d3d1c7;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.field-input:focus {
  border-color: #185fa5;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}
.btn-cancel {
  padding: 8px 16px;
  background: white;
  border: 1px solid #d3d1c7;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  color: #2c2c2a;
}
.btn-cancel:hover {
  background: #f7f6f3;
}
.btn-submit {
  padding: 8px 16px;
  background: #185fa5;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.btn-submit:hover {
  background: #145189;
}
</style>
