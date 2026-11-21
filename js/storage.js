/* Dữ liệu nháp không gửi tới máy chủ: chỉ lưu trong IndexedDB của trình duyệt. */
const DATABASE_NAME = 'dau-chan-di-san-v1';
let databasePromise;

function openDatabase() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('Trình duyệt không hỗ trợ lưu bản nháp.'));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
}

async function requestStore(storeName, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let value;
    try {
      const request = operation(store);
      request.onsuccess = () => { value = request.result; };
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Thao tác lưu trữ bị hủy.'));
  });
}

function readDraft() {
  return requestStore('settings', 'readonly', (store) => store.get('draft'));
}

function writeDraft(catalog) {
  return requestStore('settings', 'readwrite', (store) => store.put(catalog, 'draft'));
}

function storeFile(key, blob) {
  return requestStore('files', 'readwrite', (store) => store.put(blob, key));
}

function readFile(key) {
  return requestStore('files', 'readonly', (store) => store.get(key));
}

function removeFile(key) {
  return requestStore('files', 'readwrite', (store) => store.delete(key));
}

async function clearEverything() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['settings', 'files'], 'readwrite');
    transaction.objectStore('settings').clear();
    transaction.objectStore('files').clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Không thể xóa bản nháp.'));
  });
}
