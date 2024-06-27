import path from "path";
import * as fs from 'fs';
import { readFile } from "fs/promises";
import { AdaptiveGradingDaemonConfig } from "./AdaptiveGradingDaemonConfig.model.js";

export class AdaptiveGradingConfigProvider {
    public static readonly instance = new AdaptiveGradingConfigProvider();

    private constructor() {}

    private configuration: AdaptiveGradingDaemonConfig | null = null;

    public async parseConfigFile(filePath: string): Promise<void> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Given configuration file ${path.resolve(filePath)} does not exist`);
        }

        this.configuration = JSON.parse(
            await readFile(
                filePath,
                { encoding: "utf-8", flag: "r" }
            )
        );
    }

    public hasConfiguration(): boolean {
        return this.configuration !== null;
    }

    public getConfiguration(): AdaptiveGradingDaemonConfig {
        if (this.configuration === null) {
            throw new Error("Configuration was not loaded");
        }

        return this.configuration;
    }
}
