import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import BatchWorkspace from '@/views/BatchWorkspace.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/zone1', component: BatchWorkspace },
    { path: '/logbook', component: BatchWorkspace },  // placeholder
    { path: '/report', component: BatchWorkspace },   // placeholder
  ],
})

export default router
