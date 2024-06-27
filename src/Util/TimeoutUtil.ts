import { ScanInterval } from "../ApplicationModel/Daemon/DaemonConfig.model.js";

class TimerInstance {
    private static readonly MAX_INT = 2147483647;

    private static getMilis(scanInterval: ScanInterval): number {
        return (
            (scanInterval.days ?? 0) * (24 * 3600 * 1000) +
            (scanInterval.hours ?? 0) * (3600 * 1000) +
            (scanInterval.minutes ?? 0) * (60 * 1000) +
            (scanInterval.seconds ?? 0) * (1000)
        );
    }

    private currentTimeoutId: NodeJS.Timeout | null = null;
    private readonly initialTimeMs: number;
    private remainingTimeMs: number;
    private readonly finalAction: () => void;

    private constructor(
        initialTime: number | ScanInterval,
        action: () => void,
        type: "timeout" | "interval",
    ) {
        this.initialTimeMs = (typeof(initialTime) === "number") ? initialTime : TimerInstance.getMilis(initialTime);
        this.remainingTimeMs = this.initialTimeMs;

        if (type === "timeout") {
            console.log(`[INFO] TimeoutUtil: Timeout request for timeout of ${this.initialTimeMs} ms`);
            this.finalAction = action;
        } else {
            console.log(`[INFO] TimeoutUtil: Interval request with interval time value of ${this.initialTimeMs} ms`);
            this.finalAction = () => {
                action();

                this.remainingTimeMs = this.initialTimeMs;
                this.advance();
            };
        }

        this.advance();
    }

    private advance(): void {
        if (this.remainingTimeMs >= TimerInstance.MAX_INT) {
            this.remainingTimeMs -= TimerInstance.MAX_INT;
            this.currentTimeoutId = setTimeout(
                () => this.advance(),
                TimerInstance.MAX_INT,
            );
        } else {
            if (this.remainingTimeMs <= 0) {
                this.currentTimeoutId = setTimeout(() => this.finalAction(), 0);
            }

            this.currentTimeoutId = setTimeout(() => this.finalAction(), this.remainingTimeMs);
        }
    }

    public getCurrentTimeoutId(): NodeJS.Timeout | null {
        return this.currentTimeoutId;
    }

    public cancel() {
        if (this.currentTimeoutId === null) {
            return;
        }

        clearTimeout(this.currentTimeoutId);
    }

    public static doInterval(timeoutMs: number | ScanInterval, action: () => void): TimerInstance {
        return new TimerInstance(timeoutMs, action, "interval");
    }

    public static doTimeout(timeoutMs: number | ScanInterval, action: () => void): TimerInstance {
        return new TimerInstance(timeoutMs, action, "timeout");
    }
}

export class TimeoutUtil {
    public static doTimeout(time: ScanInterval, action: () => void): () => (NodeJS.Timeout | null);
    public static doTimeout(time: number, action: () => void): () => (NodeJS.Timeout | null);

    public static doTimeout(time: ScanInterval | number, action: () => void): () => (NodeJS.Timeout | null) {
        const ti = TimerInstance.doTimeout(time, action);
        return () => ti.getCurrentTimeoutId();
    }

    public static doIntervalTimeout(time: ScanInterval, action: () => void): () => (NodeJS.Timeout | null);
    public static doIntervalTimeout(time: number, action: () => void): () => (NodeJS.Timeout | null);

    public static doIntervalTimeout(time: ScanInterval | number, action: () => void): () => (NodeJS.Timeout | null) {
        const ti = TimerInstance.doInterval(time, action)
        return () => ti.getCurrentTimeoutId();
    }
}
