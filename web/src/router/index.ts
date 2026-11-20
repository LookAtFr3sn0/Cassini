import { createRouter, createWebHistory } from "vue-router";
import { loadSession } from "@/session";
import LoginView from "@/views/LoginView.vue";
import SignupView from "@/views/SignupView.vue";

const routes = [
  { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
  { path: '/signup', name: 'signup', component: SignupView, meta: { public: true } },
  { path: '/', name: 'recent', component: () => import("@/views/RecentView.vue") },
  { path: '/tokens', name: 'tokens', component: () => import("@/views/TokensView.vue") },
  { path: '/data', name: 'data', component: () => import("@/views/DataView.vue") },
  { path: '/top', redirect: '/top/artists' },
  { path: '/top/:kind(artists|tracks|albums)', name: 'top', component: () => import("@/views/TopView.vue"), props: true },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  const user = await loadSession();
  if (!user && !to.meta.public) return { name: 'login', query: { next: to.fullPath } };
  if (user && to.meta.public) return { name: 'recent' };
});

export default router;
