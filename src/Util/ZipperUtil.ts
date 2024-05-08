import * as fs from 'fs/promises';
import * as path from 'path';
import JSZip from 'jszip';

type PathStat = {
    path: string;
    isDir: boolean;
    isFile: boolean;
};

export class ZipperUtil {
    private currentZip: JSZip | null = null;

    constructor(
        private readonly paths: string[],
    ) {}

    private static async statPaths(paths: string[]): Promise<PathStat[]> {
        return await Promise.all(
            paths.map(async pth => {
                const stat = await fs.stat(pth);

                return {
                    path: pth,
                    isDir: stat.isDirectory(),
                    isFile: stat.isFile(),
                } as PathStat;
            })
        );
    }

    private async zipFile(filePath: string): Promise<void> {
        if (this.currentZip === null) {
            throw new Error("JSZip not set for the instance");
        }

        const fileContents = await fs.readFile(filePath, { flag: "r", encoding: "binary" });
        this.currentZip.file(path.basename(filePath), fileContents, { binary: true });
    }

    private async zipDir(dirPath: string, deep: boolean): Promise<void> {
        if (this.currentZip === null) {
            throw new Error("JSZip not set for the instance");
        }

        const oldZip = this.currentZip;

        this.currentZip = oldZip.folder(path.basename(dirPath));
        if (this.currentZip === null) {
            throw new Error("Unable to create folder inside zip");
        }

        const contents = (await fs.readdir(dirPath, { encoding: "utf-8" })).map(pth => path.join(dirPath, pth));

        for (const stat of await ZipperUtil.statPaths(contents)) {
            if (stat.isDir && deep) {
                await this.zipDir(stat.path, deep);
            } else if (stat.isFile) {
                await this.zipFile(stat.path);
            }
        }

        this.currentZip = oldZip;
    }

    public async zip(deep: boolean): Promise<string> {
        this.currentZip = new JSZip();
        
        for (const stat of await ZipperUtil.statPaths(this.paths)) {
            if (stat.isFile) {
                await this.zipFile(stat.path);
            } else if (stat.isDir) {
                await this.zipDir(stat.path, deep);
            }
        }

        return await this.currentZip.generateAsync({ type: "base64" });
    }
}
