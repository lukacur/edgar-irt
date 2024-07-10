import { existsSync, lstatSync } from "fs";
import { RegistryUtil } from "../../../Util/RegistryUtil.js";
import { IRegistrySource } from "./IRegistrySource.js";
import * as fs from "fs/promises";
import path from "path";
import { IRegistryPlugin } from "../../IRegistryPlugin.js";

export class PluginsRegistrySource implements IRegistrySource {
    constructor(
        private readonly pluginsFolder: string = "./Plugins",
    ) {}

    private async setupPluginDirectory() {
        if (!existsSync(this.pluginsFolder)) {
            await fs.mkdir(this.pluginsFolder, { recursive: true });
        }
    }

    private async loadFilesRec(dir: string): Promise<string[]> {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files: string[] = [];

        for (const dirent of dirents) {
            if (dirent.isFile()) {
                files.push(path.resolve(dir, dirent.name));
            } else if (dirent.isDirectory()) {
                files.push(
                    ...(await this.loadFilesRec(path.resolve(dir, dirent.name)))
                );
            }
        }

        return files;
    }

    public async loadIntoRegistries(): Promise<boolean> {
        await this.setupPluginDirectory();

        const files: string[] = await this.loadFilesRec(this.pluginsFolder);

        for (const file of files.filter(f => lstatSync(f).isFile() && f.endsWith("registry_plugin_index.js"))) {
            console.log(file);
            const imported = (await import(`file://${file}`)).default;
            const importedObjs: IRegistryPlugin[] = [];

            if (Array.isArray(imported)) {
                importedObjs.push(...imported);
            } else {
                importedObjs.push(imported);
            }

            for (const importedObj of importedObjs) {
                const registry = RegistryUtil.determineRegistry(importedObj.registry);
    
                registry
                    ?.registerItem(
                        `${importedObj.namespace}/${importedObj.name}`,
                        (...args: any[]) => importedObj.creationFunction(...args),
                    );
            }
            
        }

        return true;
    }
}
