import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      { path: '', redirect: '/mistakes' },
      {
        path: 'mistakes',
        name: 'mistake-list',
        component: () => import('@/pages/MistakeListPage.vue'),
      },
      {
        path: 'mistakes/:id',
        name: 'mistake-detail',
        component: () => import('@/pages/MistakeDetailPage.vue'),
      },
      {
        path: 'notes',
        name: 'note-list',
        component: () => import('@/pages/NoteListPage.vue'),
      },
      {
        path: 'notes/:id',
        name: 'note-detail',
        component: () => import('@/pages/NoteDetailPage.vue'),
      },
      {
        path: 'review',
        name: 'review',
        component: () => import('@/pages/ReviewPage.vue'),
      },
      {
        path: 'calendar',
        name: 'calendar',
        component: () => import('@/pages/CalendarPage.vue'),
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/pages/SettingsPage.vue'),
      },
    ],
  },

  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/ErrorNotFound.vue'),
  },
];

export default routes;
