export type UploadStatus = 'idle' | 'uploading' | 'paused' | 'success' | 'error';

export interface UploadTask {
  id: string;
  file: File;
  topicId: string;
  status: UploadStatus;
  progress: number; // 0 a 100
  fileUrl?: string;
  error?: string;
}

export interface UploadTransport {
  upload(task: UploadTask, onProgress: (progress: number) => void): Promise<string>;
  abort(taskId: string): void;
}

/**
 * Ejemplo base para gestionar la cola de subidas en el futuro
 * de forma independiente a React.
 */
export class UploadQueueManager {
  private tasks: Map<string, UploadTask> = new Map();
  private transport: UploadTransport;

  constructor(transport: UploadTransport) {
    this.transport = transport;
  }

  addTask(file: File, topicId: string): string {
    const id = crypto.randomUUID();
    this.tasks.set(id, { id, file, topicId, status: 'idle', progress: 0 });
    // In future: Automatically trigger `processQueue` if not active.
    return id;
  }

  getTask(id: string) {
    return this.tasks.get(id);
  }

  async start(id: string) {
    const task = this.tasks.get(id);
    if (!task) return;

    task.status = 'uploading';
    try {
      const url = await this.transport.upload(task, (p) => {
        task.progress = p;
        // Broadcast a listener de UI
      });
      task.status = 'success';
      task.fileUrl = url;
    } catch (err: any) {
      task.status = 'error';
      task.error = err.message || 'Error uploading file';
    }
  }

  cancel(id: string) {
    const task = this.tasks.get(id);
    if (task && task.status === 'uploading') {
      this.transport.abort(id);
      task.status = 'error';
      task.error = 'Upload aborted by user';
    }
  }
}
