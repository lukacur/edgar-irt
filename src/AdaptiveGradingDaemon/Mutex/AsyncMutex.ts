import { DelayablePromise } from "../../Util/DelayablePromise.js";

export class AsyncMutex {
    private operationMonitor: Promise<void> | null = null;

    public async lock(): Promise<DelayablePromise<void>> {
        while (this.operationMonitor !== null) {
            await this.operationMonitor;
        }

        const monitorProm = new DelayablePromise<void>();
        this.operationMonitor = monitorProm.getWrappedPromise();

        return monitorProm;
    }

    public async unlock(dp: DelayablePromise<void>): Promise<void> {
        this.operationMonitor = null;
        dp.delayedResolve();
    }
}
