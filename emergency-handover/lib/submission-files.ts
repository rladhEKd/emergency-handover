"use client";

type SubmissionFileRecord = {
  id: string;
  blob: Blob;
  originalFilename: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type StoredSubmissionFileMeta = {
  fileId: string;
  originalFilename: string;
  mimeType: string;
  size: number;
};

const DB_NAME = "hackathon-submit-files-v1";
const STORE_NAME = "files";
const DB_VERSION = 1;

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB를 열 수 없습니다."));
  });
}

async function runStoreWrite<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void) {
  const db = await openDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    action(store, resolve, reject);
    transaction.onerror = () => reject(transaction.error ?? new Error("파일 저장소 작업에 실패했습니다."));
    transaction.oncomplete = () => db.close();
  });
}

export async function saveSubmissionFile(file: File) {
  const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload: SubmissionFileRecord = {
    id,
    blob: file,
    originalFilename: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    createdAt: new Date().toISOString(),
  };

  await runStoreWrite<void>("readwrite", (store, resolve, reject) => {
    const request = store.put(payload);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  return {
    fileId: id,
    originalFilename: payload.originalFilename,
    mimeType: payload.mimeType,
    size: payload.size,
  } satisfies StoredSubmissionFileMeta;
}

export async function deleteSubmissionFile(fileId: string) {
  if (!fileId) return;

  await runStoreWrite<void>("readwrite", (store, resolve, reject) => {
    const request = store.delete(fileId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSubmissionFileBlob(fileId: string) {
  if (!fileId) return null;

  return runStoreWrite<Blob | null>("readonly", (store, resolve, reject) => {
    const request = store.get(fileId);
    request.onsuccess = () => {
      const result = request.result as SubmissionFileRecord | undefined;
      resolve(result?.blob ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}
