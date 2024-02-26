import { parentPort, workerData } from "worker_threads";

const data: {
    intervalMillis: number,
    noReports: number,
} = workerData;

let currReport = 0;
const interval = setInterval(
    () => {
        process.stdout.write("\r\x1b[K");
        currReport = (currReport + 1) % data.noReports; 

        const rep = Math.round((currReport / data.noReports) * 10);

        process.stdout.write(
            `[${"=".repeat(rep)}${(rep === 10) ? "" : ">"}${" ".repeat(10 - rep)}] (${(currReport / data.noReports) * 100}%)`
        )
    },
    Math.round(data.intervalMillis / (data.noReports + 1))
);

parentPort?.addListener("message", (msg: "refresh" | "terminate") => {
    switch (msg) {
        case "refresh": {
            interval.refresh();
            break;
        }

        case "terminate": {
            clearInterval(interval);
            break;
        }

        default: {
            process.exit(15);
        }
    }
});

parentPort?.addListener("close", () => {
    clearInterval(interval);
});
