import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import BatchWorkspace from '@/views/BatchWorkspace.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/logbook', component: BatchWorkspace },
  ],
})

export default router
