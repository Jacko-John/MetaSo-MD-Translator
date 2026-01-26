<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import type { ConfigEntry, ProviderConfig, ModelConfig } from '@/types';
import ConfigActions from './config/ConfigActions.vue';
import ProviderList from './config/ProviderList.vue';
import ModelList from './config/ModelList.vue';
import LanguageSelector from './config/LanguageSelector.vue';
import ProviderModal from './config/ProviderModal.vue';
import ModelModal from './config/ModelModal.vue';

interface Props {
  config: Partial<ConfigEntry>;
  saving: boolean;
}

interface Emits {
  (e: 'update:config', value: Partial<ConfigEntry>): void;
  (e: 'save'): void;
  (e: 'clearAll'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Local state
const localConfig = ref<Partial<ConfigEntry>>({
  providers: [],
  models: [],
  selectedModelId: '',
  language: 'zh-CN'
});

// Modal states
const showProviderModal = ref(false);
const editingProviderIndex = ref<number | null>(null);
const providerForm = ref<Partial<ProviderConfig>>({
  id: '',
  name: '',
  type: 'openai',
  apiEndpoint: '',
  description: ''
});

const showModelModal = ref(false);
const editingModelIndex = ref<number | null>(null);
const modelForm = ref<Partial<ModelConfig>>({
  id: '',
  name: '',
  providerId: '',
  apiKey: '',
  description: ''
});

// Validation errors
const validationErrors = ref<Record<string, string>>({});

// Initialize from props
function initFromProps() {
  const config = props.config;
  localConfig.value = {
    providers: (config.providers || []).map(p => ({ ...p })),
    models: (config.models || []).map(m => ({ ...m })),
    selectedModelId: config.selectedModelId || '',
    language: config.language || 'zh-CN'
  };
}

// Sync to parent
function syncToParent() {
  emit('update:config', {
    providers: (localConfig.value.providers || []).map(p => ({ ...p })),
    models: (localConfig.value.models || []).map(m => ({ ...m })),
    selectedModelId: localConfig.value.selectedModelId || '',
    language: localConfig.value.language || 'zh-CN'
  });
}

// Provider management
function openAddProviderModal() {
  editingProviderIndex.value = null;
  providerForm.value = { id: '', name: '', type: 'openai', apiEndpoint: '', description: '' };
  clearErrors();
  showProviderModal.value = true;
}

function openEditProviderModal(index: number) {
  const provider = localConfig.value.providers?.[index];
  if (!provider) return;
  editingProviderIndex.value = index;
  providerForm.value = { ...provider };
  clearErrors();
  showProviderModal.value = true;
}

function closeProviderModal() {
  showProviderModal.value = false;
  clearErrors();
}

function saveProvider() {
  const providers = localConfig.value.providers || [];
  const errors: Record<string, string> = {};

  if (!providerForm.value.id?.trim()) errors.id = '提供商ID不能为空';
  if (!providerForm.value.name?.trim()) errors.name = '提供商名称不能为空';
  if (!providerForm.value.apiEndpoint?.trim()) errors.apiEndpoint = 'API 端点不能为空';

  const isDuplicate = providers.some((p, i) =>
    p.id === providerForm.value.id && i !== editingProviderIndex.value
  );
  if (isDuplicate) errors.id = '提供商ID已存在';

  validationErrors.value = errors;
  if (Object.keys(errors).length > 0) return;

  const providerConfig: ProviderConfig = {
    id: providerForm.value.id?.trim() || '',
    name: providerForm.value.name?.trim() || '',
    type: providerForm.value.type || 'openai',
    apiEndpoint: providerForm.value.apiEndpoint?.trim() || '',
    description: providerForm.value.description?.trim()
  };

  if (editingProviderIndex.value !== null) {
    providers[editingProviderIndex.value] = providerConfig;
  } else {
    providers.push(providerConfig);
  }

  localConfig.value.providers = providers;
  closeProviderModal();
  syncToParent();
}

function deleteProvider(index: number) {
  if (!confirm('确定要删除这个提供商吗？')) return;

  const providers = localConfig.value.providers || [];
  const provider = providers[index];
  const modelsUsingProvider = (localConfig.value.models || []).filter(m => m.providerId === provider.id);

  if (modelsUsingProvider.length > 0) {
    alert(`无法删除：还有 ${modelsUsingProvider.length} 个模型正在使用此提供商`);
    return;
  }

  providers.splice(index, 1);
  localConfig.value.providers = providers;
  syncToParent();
}

// Model management
function selectModel(modelId: string) {
  localConfig.value.selectedModelId = modelId;
  syncToParent();
}

function openAddModelModal() {
  const providers = localConfig.value.providers || [];
  if (providers.length === 0) {
    alert('请先添加提供商');
    return;
  }
  editingModelIndex.value = null;
  modelForm.value = { id: '', name: '', providerId: providers[0].id, apiKey: '', description: '' };
  clearErrors();
  showModelModal.value = true;
}

function openEditModelModal(index: number) {
  const model = localConfig.value.models?.[index];
  if (!model) return;
  editingModelIndex.value = index;
  modelForm.value = { ...model };
  clearErrors();
  showModelModal.value = true;
}

function closeModelModal() {
  showModelModal.value = false;
  clearErrors();
}

function saveModel() {
  const models = localConfig.value.models || [];
  const errors: Record<string, string> = {};

  if (!modelForm.value.id?.trim()) errors.id = '模型ID不能为空';
  if (!modelForm.value.name?.trim()) errors.name = '模型名称不能为空';
  if (!modelForm.value.providerId) errors.providerId = '请选择提供商';
  if (!modelForm.value.apiKey?.trim()) errors.apiKey = 'API Key 不能为空';

  const isDuplicate = models.some((m, i) =>
    m.id === modelForm.value.id && i !== editingModelIndex.value
  );
  if (isDuplicate) errors.id = '模型ID已存在';

  validationErrors.value = errors;
  if (Object.keys(errors).length > 0) return;

  const modelConfig: ModelConfig = {
    id: modelForm.value.id?.trim() || '',
    name: modelForm.value.name?.trim() || '',
    providerId: modelForm.value.providerId || '',
    apiKey: modelForm.value.apiKey?.trim() || '',
    description: modelForm.value.description?.trim()
  };

  if (editingModelIndex.value !== null) {
    models[editingModelIndex.value] = modelConfig;
  } else {
    models.push(modelConfig);
    if (models.length === 1) localConfig.value.selectedModelId = modelConfig.id;
  }

  localConfig.value.models = models;
  closeModelModal();
  syncToParent();
}

function deleteModel(index: number) {
  if (!confirm('确定要删除这个模型吗？')) return;

  const models = localConfig.value.models || [];
  const model = models[index];
  models.splice(index, 1);
  localConfig.value.models = models;

  if (localConfig.value.selectedModelId === model.id) {
    localConfig.value.selectedModelId = models[0]?.id || '';
  }

  syncToParent();
}

// Language
function updateLanguage(language: string) {
  localConfig.value.language = language;
  syncToParent();
}

// Save config
function handleSave() {
  syncToParent();
  const errors: Record<string, string> = {};
  const providers = localConfig.value.providers || [];
  const models = localConfig.value.models || [];

  if (providers.length === 0) errors.providers = '至少需要配置一个提供商';
  if (models.length === 0) errors.models = '至少需要配置一个模型';
  if (!localConfig.value.selectedModelId) errors.selectedModel = '请选择一个模型';

  validationErrors.value = errors;
  if (Object.keys(errors).length > 0) {
    alert('请修正配置错误后再保存');
    return;
  }

  emit('save');
}

function clearErrors() {
  validationErrors.value = {};
}

// Lifecycle
onMounted(() => {
  initFromProps();
});

watch(() => props.config, (newConfig) => {
  if (newConfig && (newConfig.providers || newConfig.models)) {
    initFromProps();
  }
}, { deep: true });
</script>

<template>
  <div class="config-tab">
    <!-- Welcome Section -->
    <div class="welcome-section">
      <h2>📝 MetaSo MD 翻译器配置</h2>
      <p class="subtitle">配置 API 提供商和 AI 模型</p>
    </div>

    <!-- Statistics -->
    <div class="stats-section">
      <div class="stat-item">
        <span class="stat-label">提供商</span>
        <span class="stat-value">{{ localConfig.providers?.length || 0 }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">模型</span>
        <span class="stat-value">{{ localConfig.models?.length || 0 }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">语言</span>
        <span class="stat-value">{{ localConfig.language }}</span>
      </div>
    </div>

    <!-- Provider Section -->
    <ProviderList
      :providers="localConfig.providers || []"
      :validation-errors="validationErrors"
      @add="openAddProviderModal"
      @edit="openEditProviderModal"
      @delete="deleteProvider"
    />

    <!-- Model Section -->
    <ModelList
      :models="localConfig.models || []"
      :providers="localConfig.providers || []"
      :selected-model-id="localConfig.selectedModelId || ''"
      :validation-errors="validationErrors"
      @select="selectModel"
      @add="openAddModelModal"
      @edit="openEditModelModal"
      @delete="deleteModel"
    />

    <!-- Language Selection -->
    <LanguageSelector
      :current-language="localConfig.language || 'zh-CN'"
      @select="updateLanguage"
    />

    <!-- Actions -->
    <ConfigActions
      :saving="saving"
      @save="handleSave"
      @clear-all="emit('clearAll')"
    />

    <!-- Provider Modal -->
    <ProviderModal
      v-model:show="showProviderModal"
      v-model:provider-data="providerForm"
      :mode="editingProviderIndex !== null ? 'edit' : 'add'"
      :validation-errors="validationErrors"
      @save="saveProvider"
      @cancel="closeProviderModal"
    />

    <!-- Model Modal -->
    <ModelModal
      v-model:show="showModelModal"
      v-model:model-data="modelForm"
      :providers="localConfig.providers || []"
      :mode="editingModelIndex !== null ? 'edit' : 'add'"
      :validation-errors="validationErrors"
      @save="saveModel"
      @cancel="closeModelModal"
    />
  </div>
</template>

<style scoped>
.config-tab {
  padding: 20px;
}

.welcome-section {
  text-align: center;
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, #667eea10, #764ba210);
  border-radius: 12px;
  border: 2px solid #e5e7eb;
}

.welcome-section h2 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #374151;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

.stats-section {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  border: 2px solid #e5e7eb;
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 600;
  color: #667eea;
}
</style>
