export class DelayablePromise<T> {
    // TODO: add a 'private resolved: boolean = false' field
    private resolveRequestResolver: ((value: boolean) => void) | null = null; // TODO: should be a list
    private rejectRequestResolver: ((value: boolean) => void) | null = null; // TODO: should be a list

    private resolveFn: ((value: T | PromiseLike<T>) => void) | null = null;
    private rejectFn: ((reason: any) => void) | null = null;

    private readonly promise: Promise<T>;

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolveFn = resolve;
            if (this.resolveRequestResolver !== null) {
                this.resolveRequestResolver(true);
            }

            this.rejectFn = reject;
            if (this.rejectRequestResolver !== null) {
                this.rejectRequestResolver(true);
            }
        });
    }

    public getWrappedPromise(): Promise<T> {
        return this.promise;
    }

    public async delayedResolve(value: T | PromiseLike<T>): Promise<void> {
        if (this.resolveFn === null) {
            return (new Promise<boolean>((resolve, _) => this.resolveRequestResolver = resolve))
                .then(() => this.resolveFn!(value));
        }

        this.resolveFn(value);
    }

    public async delayedReject(reason?: any): Promise<void> {
        if (this.rejectFn === null) {
            return (new Promise<boolean>((resolve, _) => this.rejectRequestResolver = resolve))
                .then(() => this.rejectFn!(reason));
        }

        this.rejectFn(reason);
    }
}
