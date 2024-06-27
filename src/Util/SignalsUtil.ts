export class SignalsUtil {
    public static readonly instance = new SignalsUtil();

    private constructor() {}

    private readonly signalListeners: Map<NodeJS.Signals, NodeJS.SignalsListener[]> = new Map();

    public addListener(signal: NodeJS.Signals, lst: NodeJS.SignalsListener): void {
        if (!this.signalListeners.has(signal)) {
            this.signalListeners.set(signal, []);
        }
        this.signalListeners.get(signal)!.push(lst);
    }

    public removeListener(signal: NodeJS.Signals, lst: NodeJS.SignalsListener): void {
        if (!this.signalListeners.has(signal)) {
            return;
        }

        const arr = this.signalListeners.get(signal)!;

        const idx = arr.indexOf(lst);
        if (idx === -1) {
            return;
        }

        arr.splice(idx, 1);
    }

    public registerTerminationListener(lst: NodeJS.SignalsListener): void {
        this.addListener("SIGINT", lst);
        this.addListener("SIGTERM", lst);
        this.addListener("SIGKILL", lst);
    }

    public unregisterTerminationListener(lst: NodeJS.SignalsListener): void {
        this.removeListener("SIGINT", lst);
        this.removeListener("SIGTERM", lst);
        this.removeListener("SIGKILL", lst);
    }

    public emit(signal: NodeJS.Signals): void {
        if (!this.signalListeners.has(signal)) {
            return;
        }

        this.signalListeners.get(signal)!.forEach(lst => lst(signal));
    }
}
