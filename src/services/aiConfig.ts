import { LocalStorage } from 'quasar';

export interface AiConfig {
  aiApiKey: string;
  aiEndpoint: string;
  aiModel: string;
}

const DEFAULT_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-vl-plus';

/**
 * 读取本地存储中的 AI 配置。
 * 密钥仅保存在本地（localStorage），每次请求时传给后端代理，前端代码中不硬编码。
 */
export function getAiConfig(): AiConfig {
  return {
    aiApiKey: (LocalStorage.getItem('aiApiKey') as string) || '',
    aiEndpoint: (LocalStorage.getItem('aiEndpoint') as string) || DEFAULT_ENDPOINT,
    aiModel: (LocalStorage.getItem('aiModel') as string) || DEFAULT_MODEL,
  };
}
