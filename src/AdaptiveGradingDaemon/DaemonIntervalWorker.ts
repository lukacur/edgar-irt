import { parentPort, workerData } from "worker_threads";

const data: {
    intervalMillis: number,
} = workerData;

const int = setInterval(
    () => {
        parentPort?.postMessage("doAction");
    },
    data.intervalMillis
);

parentPort?.on("message", (msg: "refresh" | "terminate") => {
    switch (msg) {
        case "refresh": {
            int.refresh();
            break;
        }

        case "terminate": {
            clearInterval(int);
            break;
        }

        default: {
            process.exit(15);
        }
    }
});

parentPort?.on("close", () => {
    clearInterval(int);
});
