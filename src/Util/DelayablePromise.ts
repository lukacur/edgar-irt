export class DelayablePromise<T> {
    private finished: boolean = false;

    private resolveRequests: ((value: boolean) => void)[] = [];
    private rejectRequests: ((value: boolean) => void)[] = [];

    private resolveFn: ((value: T | PromiseLike<T>) => void) | null = null;
    private rejectFn: ((reason: any) => void) | null = null;

    private readonly promise: Promise<T>;

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolveFn = resolve;
            if (this.resolveRequests !== null) {
                this.resolveRequests.forEach(rs => rs(true));
            }

            this.rejectFn = reject;
            if (this.rejectRequests !== null) {
                this.rejectRequests.forEach(rs => rs(true));
            }
        });
    }

    public getWrappedPromise(): Promise<T> {
        return this.promise;
    }

    public async delayedResolve(value: T | PromiseLike<T>): Promise<void> {
        if (this.finished) {
            return;
        }

        if (this.resolveFn === null) {
            return (new Promise<boolean>((resolve, _) => this.resolveRequests.push(resolve)))
                .then(() => this.resolveFn!(value));
        }

        this.resolveFn(value);
        this.finished = true;
    }
    
    public async delayedReject(reason?: any): Promise<void> {
        if (this.finished) {
            return;
        }

        if (this.rejectFn === null) {
            return (new Promise<boolean>((resolve, _) => this.rejectRequests.push(resolve)))
                .then(() => this.rejectFn!(reason));
        }
        
        this.rejectFn(reason);
        this.finished = true;
    }
}
