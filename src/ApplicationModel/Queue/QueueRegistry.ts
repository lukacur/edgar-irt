import { IQueueSystemBase } from "./IQueueSystemBase.js";

type QueueRegistryActionResult<TActionResult> =
    {
        status: "success";
        result: TActionResult;
    } |
    {
        status: "failure";
        message: string;
    };

export class QueueRegistry {
    public static readonly instance = new QueueRegistry();

    private readonly registry: Map<string, IQueueSystemBase<any>> = new Map();

    private constructor() {}

    public registerQueue(queueName: string, queueSystem: IQueueSystemBase<any>): QueueRegistryActionResult<boolean> {
        if (this.registry.has(queueName)) {
            return {
                status: "failure",
                message: `Queue is already registered under the name: ${queueName}`,
            };
        }

        this.registry.set(queueName, queueSystem);

        return {
            status: "success",
            result: true,
        };
    }

    public unregisterQueue(queueName: string): QueueRegistryActionResult<boolean> {
        return {
            status: "success",
            result: this.registry.delete(queueName),
        };
    }

    public getQueue<TQueueItem>(queueName: string): QueueRegistryActionResult<IQueueSystemBase<TQueueItem>> {
        if (!this.registry.has(queueName)) {
            return {
                status: "failure",
                message: `No queue was registered under the name: ${queueName}`,
            };
        }

        return {
            status: "success",
            result: this.registry.get(queueName)!,
        }
    }
}
