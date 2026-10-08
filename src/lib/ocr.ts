/**
 * 解説プレートの文字を端末上で読み取る（無料の tesseract.js、日本語＋英語）。
 * 初回は言語データ（数MB）をダウンロードするため時間がかかる。以降はブラウザにキャッシュされる。
 */
import { compressImage } from './image';

type Progress = (p: { status: string; progress: number }) => void;

export async function ocrPlate(files: File[], onProgress?: Progress): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['jpn', 'eng'], 1, {
    logger: (m: { status: string; progress: number }) => onProgress?.(m),
  });
  try {
    const texts: string[] = [];
    for (const f of files) {
      const blob = await compressImage(f, 2000, 0.92); // 文字が潰れないよう少し大きめ
      const { data } = await worker.recognize(blob);
      texts.push(cleanup(data.text));
    }
    return texts.filter(Boolean).join('\n---\n');
  } finally {
    await worker.terminate();
  }
}

/** OCR 結果の余分な空白を整理（日本語の文字間スペースを詰める） */
function cleanup(t: string) {
  return t
    .replace(/([　-鿿＀-￯])\s+(?=[　-鿿＀-￯])/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
