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
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-h6">同步服务配置</div>
        <q-input v-model="syncUrl" label="后端同步服务 URL" outlined class="q-mt-sm" />
        <q-input v-model="syncToken" label="认证令牌" outlined type="password" class="q-mt-sm">
          <template v-slot:append>
            <q-icon :name="showToken ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showToken = !showToken" />
          </template>
        </q-input>
        <q-btn label="测试连接" color="primary" outline class="q-mt-sm" />
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-h6">OCR 服务配置</div>
        <q-select v-model="ocrProvider" :options="ocrProviders" label="服务商" outlined class="q-mt-sm" />
        <q-input v-model="ocrApiKey" label="API Key" outlined type="password" class="q-mt-sm" />
        <q-input v-model="ocrSecret" label="API Secret" outlined type="password" class="q-mt-sm" />
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

    <div class="row justify-center q-mt-md">
      <q-btn color="primary" icon="save" label="保存设置" @click="saveSettings" unelevated class="full-width" style="max-width: 400px" />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar } from 'quasar';

const $q = useQuasar();

const darkMode = ref(false);
const showToken = ref(false);

const syncUrl = ref('');
const syncToken = ref('');

const ocrProvider = ref('baidu');
const ocrProviders = ['百度云', '阿里云'];
const ocrApiKey = ref('');
const ocrSecret = ref('');

const aiEndpoint = ref('');
const aiModel = ref('');
const aiApiKey = ref('');

onMounted(() => {
  darkMode.value = $q.dark.isActive;
  syncUrl.value = $q.localStorage.getItem('syncUrl') as string || '';
  syncToken.value = $q.localStorage.getItem('syncToken') as string || '';
  ocrApiKey.value = $q.localStorage.getItem('ocrApiKey') as string || '';
  ocrSecret.value = $q.localStorage.getItem('ocrSecret') as string || '';
  aiEndpoint.value = $q.localStorage.getItem('aiEndpoint') as string || '';
  aiModel.value = $q.localStorage.getItem('aiModel') as string || '';
  aiApiKey.value = $q.localStorage.getItem('aiApiKey') as string || '';
});

function toggleDark(val: boolean) {
  $q.dark.set(val);
  $q.localStorage.set('darkMode', val);
}

function saveSettings() {
  $q.localStorage.set('syncUrl', syncUrl.value);
  $q.localStorage.set('syncToken', syncToken.value);
  $q.localStorage.set('ocrProvider', ocrProvider.value);
  $q.localStorage.set('ocrApiKey', ocrApiKey.value);
  $q.localStorage.set('ocrSecret', ocrSecret.value);
  $q.localStorage.set('aiEndpoint', aiEndpoint.value);
  $q.localStorage.set('aiModel', aiModel.value);
  $q.localStorage.set('aiApiKey', aiApiKey.value);
  $q.notify({ type: 'positive', message: '设置已保存', timeout: 1500 });
}
</script>
