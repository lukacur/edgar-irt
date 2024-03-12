export interface IQueueSystemBase<TQueueData> {
    enqueue(data: TQueueData): Promise<boolean>;
    dequeue(): Promise<TQueueData>;
    peek(): Promise<TQueueData | null>;

    empty(): Promise<boolean>;

    close(): Promise<void>;
}
