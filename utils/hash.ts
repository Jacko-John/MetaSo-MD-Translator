// Hash utilities for content change detection

/**
 * 生成简单的字符串哈希值
 * 使用 FNV-1a 算法的 32 位变体
 * @param str - 要哈希的字符串
 * @returns 哈希值（十六进制字符串）
 */
export function generateHash(str: string): string {
  let hash = 0x811c9dc5; // FNV offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }

  // 转换为无符号整数，然后转十六进制
  return (hash >>> 0).toString(16);
}

/**
 * 生成对象的哈希值
 * @param obj - 要哈希的对象
 * @returns 哈希值（十六进制字符串）
 */
export function generateObjectHash(obj: any): string {
  const str = JSON.stringify(obj);
  return generateHash(str);
}

/**
 * 比较两个内容的哈希值是否相同
 * @param content1 - 内容 1
 * @param content2 - 内容 2
 * @returns 是否相同
 */
export function compareContentHash(content1: any, content2: any): boolean {
  const hash1 = generateObjectHash(content1);
  const hash2 = generateObjectHash(content2);
  return hash1 === hash2;
}
