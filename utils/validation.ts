import type { ExportData } from '@/types';

/**
 * 验证导出数据格式
 */
export function validateExportData(data: any): { valid: boolean; error?: string } {
  // 检查基本结构
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '无效的数据格式' };
  }

  // 检查版本
  if (typeof data.version !== 'string') {
    return { valid: false, error: '缺少版本信息' };
  }

  // 检查 translations 数组
  if (!Array.isArray(data.translations)) {
    return { valid: false, error: '缺少翻译记录数组' };
  }

  // 检查每个翻译记录的基本结构
  for (let i = 0; i < data.translations.length; i++) {
    const item = data.translations[i];
    if (!item.id || typeof item.id !== 'string') {
      return { valid: false, error: `第 ${i + 1} 条记录缺少 id` };
    }
    if (!item.status || !['completed', 'failed', 'pending'].includes(item.status)) {
      return { valid: false, error: `第 ${i + 1} 条记录的 status 无效` };
    }
    if (!item.meta || typeof item.meta !== 'object') {
      return { valid: false, error: `第 ${i + 1} 条记录缺少 meta 信息` };
    }
  }

  return { valid: true };
}
