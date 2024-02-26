import { MainRunner } from "./EdgarIRT.entrypoint.js";

const CMD_ARGS: string[] = process.argv;
const PROC_ENV_ARGS: string[] = CMD_ARGS.slice(0, 2);

MainRunner.main(CMD_ARGS.slice(2));
