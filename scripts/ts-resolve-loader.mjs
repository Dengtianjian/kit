import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Node 的 TS 类型擦除不做 extensionless 解析；这里按 Vite 习惯补 .ts / index.ts */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) throw error;
    const base = new URL(specifier, context.parentURL);
    const path = fileURLToPath(base);
    for (const candidate of [`${path}.ts`, `${path}.tsx`, `${path}/index.ts`]) {
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    throw error;
  }
}