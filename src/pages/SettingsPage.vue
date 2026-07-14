<template>
  <q-page class="q-pa-md">
    <h5 class="q-my-none q-mb-md text-weight-medium">设置</h5>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-h6">外观</div>
        <q-item>
          <q-item-section>
            <q-item-label>暗色模式</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle v-model="darkMode" @update:model-value="toggleDark" />
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-section>
            <q-item-label>图片压缩</q-item-label>
            <q-item-label caption>上传前压缩至最大宽度 1200px，质量 80%</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle v-model="compressImages" />
          </q-item-section>
        </q-item>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-h6">Supabase 云同步</div>
        <q-input v-model="supabaseUrl" label="Supabase URL" outlined class="q-mt-sm"
          placeholder="https://xxxxxxxxxxxx.supabase.co" />
        <q-input v-model="supabaseAnonKey" label="Anon Key" outlined type="password" class="q-mt-sm">
          <template v-slot:append>
            <q-icon :name="showKey ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showKey = !showKey" />
          </template>
        </q-input>

        <q-separator class="q-my-md" />

        <div v-if="sessionUser" class="row items-center q-mb-sm">
          <q-icon name="check_circle" color="positive" size="sm" class="q-mr-xs" />
          <span class="text-body2">已登录 {{ sessionUser.email }}</span>
        </div>
        <div v-else class="text-body2 text-grey q-mb-sm">未登录（需先保存 Supabase 配置）</div>

        <template v-if="sessionUser">
          <q-btn label="退出登录" color="negative" outline class="q-mt-sm" @click="logout" :loading="authLoading" />
        </template>
        <template v-else>
          <q-input v-model="authEmail" label="邮箱" outlined class="q-mt-sm" />
          <q-input v-model="authPassword" label="密码" outlined type="password" class="q-mt-sm" />
          <div class="row q-mt-sm q-gutter-sm">
            <q-btn label="登录" color="primary" @click="login" :loading="authLoading" :disable="!supabaseReady" />
            <q-btn label="注册" color="secondary" @click="register" :loading="authLoading" :disable="!supabaseReady" />
          </div>
        </template>
      </q-card-section>
    </q-card>

    
    <q-card flat bordered>
      <q-card-section>
        <div class="text-h6">AI 服务配置</div>
        <q-input v-model="aiEndpoint" label="API 接口地址" outlined class="q-mt-sm" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
        <q-input v-model="aiModel" label="模型名称" outlined class="q-mt-sm" placeholder="qwen-vl-plus" />
        <div class="text-caption q-mb-xs text-grey">截图识别需使用支持视觉的模型（如 qwen-vl-plus）；文本分析可用 qwen-plus / qwen-turbo 等。</div>
        <q-input v-model="aiApiKey" label="API Key" outlined type="password" class="q-mt-sm" />
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-h6">缤纷云存储</div>
        <div class="text-caption text-grey q-mb-sm">用于跨设备同步图片（S3 兼容存储，如 缤纷云、MinIO、AWS S3）</div>
        <q-banner type="warning" class="q-mb-sm rounded-borders">
          <template v-slot:avatar>
            <q-icon name="warning" />
          </template>
          AccessKey/Secret 保存在本地并在浏览器中签名 S3 请求，通过 DevTools 或 XSS 可被读取。建议：配置 Bucket Policy 为限定前缀 + public-read + put-only（禁止删除），并使用专用受限凭证。
        </q-banner>
        <q-input v-model="cloudEndpoint" label="Endpoint 地址" outlined class="q-mt-sm" placeholder="https://s3.binfen.com" />
        <q-input v-model="cloudRegion" label="Region" outlined class="q-mt-sm" placeholder="auto" />
        <q-input v-model="cloudBucket" label="Bucket 名称" outlined class="q-mt-sm" placeholder="my-images" />
        <q-input v-model="cloudAccessKey" label="Access Key" outlined class="q-mt-sm" />
        <q-input v-model="cloudSecretKey" label="Secret Key" outlined type="password" class="q-mt-sm" />
        <q-input v-model="cloudPublicUrl" label="Public URL 前缀（可选）" outlined class="q-mt-sm"
          placeholder="留空则自动生成" />
        <div class="row q-mt-sm q-gutter-sm">
          <q-btn label="测试连接" color="secondary" outline :loading="cloudTesting" @click="handleTestCloud"
            :disable="!cloudReady" />
        </div>
        <q-banner v-if="cloudStatus" :class="cloudStatusOk ? 'bg-positive' : 'bg-negative'"
          class="text-white q-pa-sm q-mt-sm rounded-borders">
          {{ cloudStatus }}
        </q-banner>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-h6">同步冲突</div>
        <div class="text-caption text-grey q-mb-sm">数量：{{ syncStore.conflictCount }}</div>
        <q-list v-if="conflicts.length > 0" separator>
          <q-item v-for="item in conflicts" :key="item.id">
            <q-item-section>
              <q-item-label>{{ item.entity_type }} · {{ item.entity_id }}</q-item-label>
              <q-item-label caption>{{ item.created_at }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-btn dense outline color="primary" label="保留本地" size="sm" @click="handleResolve(item.id, 'local')" />
                <q-btn dense outline color="secondary" label="采用云端" size="sm" @click="handleResolve(item.id, 'remote')" />
                <q-btn dense outline color="grey" label="忽略" size="sm" @click="handleResolve(item.id, 'dismiss')" />
              </div>
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="text-body2 text-grey">无同步冲突</div>
      </q-card-section>
    </q-card>

    <div class="row justify-center q-mt-md">
      <q-btn color="primary" icon="save" label="保存设置" @click="saveSettings" unelevated class="full-width" style="max-width: 400px" />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { createSupabaseClient, restoreSession, signIn, signUp, signOut } from '@/services/supabase';
import { testConnection as testCloud, initCloudStore } from '@/services/cloudStore';
import { loadAiApiKey, storeAiApiKey } from '@/services/aiConfig';
import { getConflicts, resolveConflict, type ConflictRow } from '@/services/syncService';
import { useSyncStore } from '@/stores/syncStore';

const $q = useQuasar();

const darkMode = ref(false);
const compressImages = ref(true);
const showKey = ref(false);

const supabaseUrl = ref('');
const supabaseAnonKey = ref('');
const authEmail = ref('');
const authPassword = ref('');
const authLoading = ref(false);
const sessionUser = ref<{ email?: string } | null>(null);
const supabaseReady = computed(() => !!supabaseUrl.value && !!supabaseAnonKey.value);

const aiEndpoint = ref('');
const aiModel = ref('');
const aiApiKey = ref('');

const cloudEndpoint = ref('');
const cloudRegion = ref('auto');
const cloudBucket = ref('');
const cloudAccessKey = ref('');
const cloudSecretKey = ref('');
const cloudPublicUrl = ref('');
const cloudTesting = ref(false);
const cloudStatus = ref('');
const cloudStatusOk = ref(false);
const cloudReady = computed(() => !!cloudEndpoint.value && !!cloudBucket.value && !!cloudAccessKey.value && !!cloudSecretKey.value);

const syncStore = useSyncStore();
const conflicts = ref<ConflictRow[]>([]);

onMounted(async () => {
  darkMode.value = $q.dark.isActive;
  compressImages.value = $q.localStorage.getItem('compressImages') !== 'false';
  supabaseUrl.value = $q.localStorage.getItem('supabaseUrl') as string || '';
  supabaseAnonKey.value = $q.localStorage.getItem('supabaseAnonKey') as string || '';
  aiEndpoint.value = $q.localStorage.getItem('aiEndpoint') as string || '';
  aiModel.value = $q.localStorage.getItem('aiModel') as string || '';
  aiApiKey.value = await loadAiApiKey();
  cloudEndpoint.value = $q.localStorage.getItem('cloudEndpoint') as string || '';
  cloudRegion.value = $q.localStorage.getItem('cloudRegion') as string || 'auto';
  cloudBucket.value = $q.localStorage.getItem('cloudBucket') as string || '';
  cloudAccessKey.value = $q.localStorage.getItem('cloudAccessKey') as string || '';
  cloudSecretKey.value = $q.localStorage.getItem('cloudSecretKey') as string || '';
  cloudPublicUrl.value = $q.localStorage.getItem('cloudPublicUrl') as string || '';

  if (supabaseUrl.value && supabaseAnonKey.value) {
    createSupabaseClient(supabaseUrl.value, supabaseAnonKey.value);
    const user = await restoreSession();
    if (user) {
      sessionUser.value = { email: user.email ?? undefined };
    }
  }

  conflicts.value = await getConflicts();
  await syncStore.loadConflictCount();
});

function toggleDark(val: boolean) {
  $q.dark.set(val);
  $q.localStorage.set('darkMode', val);
}

async function login() {
  authLoading.value = true;
  try {
    // Re-create client from current form values in case user just changed them
    if (supabaseUrl.value && supabaseAnonKey.value) {
      createSupabaseClient(supabaseUrl.value, supabaseAnonKey.value);
    }
    const user = await signIn(authEmail.value, authPassword.value);
    if (user) {
      sessionUser.value = { email: user.email ?? undefined };
      // Save config so initSupabaseFromStorage picks it up on next boot
      $q.localStorage.set('supabaseUrl', supabaseUrl.value);
      $q.localStorage.set('supabaseAnonKey', supabaseAnonKey.value);
    } else {
      $q.notify({ type: 'warning', message: '登录返回空用户', timeout: 2000 });
    }
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `登录失败：${e?.message || e}`, timeout: 3000 });
  } finally {
    authLoading.value = false;
  }
}

async function register() {
  authLoading.value = true;
  try {
    if (supabaseUrl.value && supabaseAnonKey.value) {
      createSupabaseClient(supabaseUrl.value, supabaseAnonKey.value);
    }
    const user = await signUp(authEmail.value, authPassword.value);
    if (user) {
      sessionUser.value = { email: user.email ?? undefined };
      $q.localStorage.set('supabaseUrl', supabaseUrl.value);
      $q.localStorage.set('supabaseAnonKey', supabaseAnonKey.value);
      $q.notify({ type: 'positive', message: '注册成功', timeout: 2000 });
    } else {
      $q.notify({ type: 'info', message: '注册链接已发送到邮箱，请查收并确认', timeout: 3000 });
    }
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `注册失败：${e?.message || e}`, timeout: 3000 });
  } finally {
    authLoading.value = false;
  }
}

async function logout() {
  authLoading.value = true;
  try {
    await signOut();
    sessionUser.value = null;
    $q.notify({ type: 'positive', message: '已退出登录', timeout: 2000 });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `退出失败：${e?.message || e}`, timeout: 3000 });
  } finally {
    authLoading.value = false;
  }
}

async function handleTestCloud() {
  cloudTesting.value = true;
  cloudStatus.value = '';
  try {
    const ok = await testCloud({
      endpoint: cloudEndpoint.value,
      region: cloudRegion.value || 'auto',
      bucket: cloudBucket.value,
      accessKey: cloudAccessKey.value,
      secretKey: cloudSecretKey.value,
      publicUrlBase: cloudPublicUrl.value || undefined,
    });
    cloudStatus.value = ok ? '✅ 连接成功，密钥有效' : '❌ 连接失败，请检查配置';
    cloudStatusOk.value = ok;
  } catch (e: any) {
    cloudStatus.value = `❌ 连接异常：${e?.message || e}`;
    cloudStatusOk.value = false;
  } finally {
    cloudTesting.value = false;
  }
}

async function handleResolve(id: string, action: 'local' | 'remote' | 'dismiss') {
  try {
    await resolveConflict(id, action);
    conflicts.value = await getConflicts();
    await syncStore.loadConflictCount();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `操作失败：${e?.message || e}`, timeout: 3000 });
  }
}

async function saveSettings() {
  $q.localStorage.set('compressImages', compressImages.value);
  $q.localStorage.set('supabaseUrl', supabaseUrl.value);
  $q.localStorage.set('supabaseAnonKey', supabaseAnonKey.value);
  $q.localStorage.set('aiEndpoint', aiEndpoint.value);
  $q.localStorage.set('aiModel', aiModel.value);
  await storeAiApiKey(aiApiKey.value);
  $q.localStorage.set('cloudEndpoint', cloudEndpoint.value);
  $q.localStorage.set('cloudRegion', cloudRegion.value);
  $q.localStorage.set('cloudBucket', cloudBucket.value);
  $q.localStorage.set('cloudAccessKey', cloudAccessKey.value);
  $q.localStorage.set('cloudSecretKey', cloudSecretKey.value);
  $q.localStorage.set('cloudPublicUrl', cloudPublicUrl.value);
  // Init cloud store immediately (no restart needed)
  if (cloudEndpoint.value && cloudBucket.value && cloudAccessKey.value && cloudSecretKey.value) {
    initCloudStore({
      endpoint: cloudEndpoint.value,
      region: cloudRegion.value || 'auto',
      bucket: cloudBucket.value,
      accessKey: cloudAccessKey.value,
      secretKey: cloudSecretKey.value,
      publicUrlBase: cloudPublicUrl.value || undefined,
    });
  }
  $q.notify({ type: 'positive', message: '设置已保存', timeout: 1500 });
}
</script>
