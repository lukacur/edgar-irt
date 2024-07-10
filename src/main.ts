import { readdir } from "fs/promises";
import { EdgarIRTEntrypoint } from "./EdgarIRT.entrypoint.js";
import { GenericJobExecutionDaemon } from "./ApplicationModel/Daemon/GenericJobExecutionDaemon.js";
import { SignalsUtil } from "./Util/SignalsUtil.js";
import { Dirent } from "fs";
import path from "path";

const CMD_ARGS: string[] = process.argv;
const PROC_ENV_ARGS: string[] = CMD_ARGS.slice(0, 2);

EdgarIRTEntrypoint.main(CMD_ARGS.slice(2));

// Start other daemons in proper configuration
(async () => {
    const basePath = "./GenericDaemonConfigurations";
    const configPaths: Dirent[] = 
        await readdir(basePath, { withFileTypes: true });

    const startedDaemons: GenericJobExecutionDaemon[] =
        configPaths
            .filter(pth => pth.isFile())
            .map(pth => {
                return new GenericJobExecutionDaemon(path.resolve(basePath, pth.name), "Generic daemon")
            });
    startedDaemons.forEach(daemon => daemon.start());

    SignalsUtil.instance.registerTerminationListener(async () => {
        await Promise.all(
            startedDaemons.map(sd => sd.shutdown())
        );
    });
})();
