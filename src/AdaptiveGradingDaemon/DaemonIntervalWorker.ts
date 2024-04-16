import { parentPort, workerData } from "worker_threads";
import { TimeoutUtil } from "../Util/TimeoutUtil.js";

const data: {
    intervalMillis: number,
} = workerData;

const getIntTimeoutId: () => (NodeJS.Timeout | null) = TimeoutUtil.doIntervalTimeout(
    data.intervalMillis,
    () => {
        parentPort?.postMessage("doAction");
    },
);

parentPort?.on("message", (msg: "refresh" | "terminate") => {
    switch (msg) {
        case "refresh": {
            getIntTimeoutId()?.refresh();
            break;
        }

        case "terminate": {
            const tid = getIntTimeoutId();

            if (tid !== null) {
                clearInterval(tid);
            }
            break;
        }

        default: {
            process.exit(15);
        }
    }
});

parentPort?.on("close", () => {
    const tid = getIntTimeoutId();

    if (tid !== null) {
        clearInterval(tid);
    }
});
