import { parentPort, workerData } from "worker_threads";
import { TimeoutUtil } from "../Util/TimeoutUtil.js";

const data: {
    intervalMillis: number,
    noReports: number,
} = workerData;

let currReport = 0;
const getIntervalTimeoutId: () => (NodeJS.Timeout | null) = TimeoutUtil.doIntervalTimeout(
    Math.round(data.intervalMillis / (data.noReports + 1)),
    () => {
        process.stdout.write("\r\x1b[K");
        currReport = (currReport + 1) % data.noReports; 

        const rep = Math.round((currReport / data.noReports) * 10);

        process.stdout.write(
            `[${"=".repeat(rep)}${(rep === 10) ? "" : ">"}${" ".repeat(10 - rep)}] (${(currReport / data.noReports) * 100}%)`
        )
    },
);

parentPort?.addListener("message", (msg: "refresh" | "terminate") => {
    switch (msg) {
        case "refresh": {
            getIntervalTimeoutId()?.refresh();
            break;
        }

        case "terminate": {
            const tid = getIntervalTimeoutId();

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

parentPort?.addListener("close", () => {
    const tid = getIntervalTimeoutId();

    if (tid !== null) {
        clearInterval(tid);
    }
});
