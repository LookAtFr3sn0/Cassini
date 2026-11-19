import { createRouter, createWebHistory } from "vue-router";
import { loadSession } from "@/session";
import LoginView from "@/views/LoginView.vue";
import RecentView from "@/views/RecentView.vue";
import TopView from "@/views/TopView.vue";

const routes = [
  { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
  { path: '/', name: 'recent', component: RecentView },
  { path: '/top', redirect: '/top/artists' },
  { path: '/top/:kind(artists|tracks|albums)', name: 'top', component: TopView, props: true },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  const user = await loadSession();
  if (!user && !to.meta.public) return { name: 'login', query: { next: to.fullPath } };
  if (user && to.name === 'login') return { name: 'recent' };
});

export default router;
