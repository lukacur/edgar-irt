import { IInputDataExtractor } from "../ApplicationModel/Jobs/DataExtractors/IInputDataExtractor.js";
import { IJobConfiguration } from "../ApplicationModel/Jobs/IJobConfiguration.js";
import { IJobStep } from "../ApplicationModel/Jobs/IJobStep.js";
import { IJobWorker } from "../ApplicationModel/Jobs/Workers/IJobWorker.js";
import { IWorkResultPersistor } from "../ApplicationModel/Jobs/WorkResultPersistors/IWorkResultPersistor.js";
import { DynamicScriptImporter } from "../PluginSupport/DynamicScriptImporter.js";
import { InputExtractorRegistry } from "../PluginSupport/Registries/Implementation/InputExtractorRegistry.js";
import { JobStepRegistry } from "../PluginSupport/Registries/Implementation/JobStepRegistry.js";
import { JobWorkerRegistry } from "../PluginSupport/Registries/Implementation/JobWorkerRegistry.js";
import { PersistorRegistry } from "../PluginSupport/Registries/Implementation/PersistorRegistry.js";

export class JobPartsParser {
    private constructor(
        private readonly jobConfiguration: IJobConfiguration,
    ) {}

    public async getInputDataExtractor(): Promise<IInputDataExtractor> {
        const ieConfig = this.jobConfiguration.inputExtractorConfig;
        const isDynamicallyImported = ieConfig.type === "dynamic" && ieConfig.importInfo !== undefined;

        return <IInputDataExtractor>(
            (isDynamicallyImported) ?
                new (await DynamicScriptImporter.importScript(ieConfig.importInfo!)).type(ieConfig) :
                InputExtractorRegistry.instance.getItem(ieConfig.type, ieConfig, this.jobConfiguration)
        );
    }

    public async getJobWorker(): Promise<IJobWorker> {
        const jwConfig = this.jobConfiguration.jobWorkerConfig;
        const isDynamicallyImported = jwConfig.type === "dynamic" && jwConfig.importInfo !== undefined;

        return <IJobWorker>(
            (isDynamicallyImported) ?
                new (await DynamicScriptImporter.importScript(jwConfig.importInfo!)).type(jwConfig) :
                JobWorkerRegistry.instance.getItem(jwConfig.type, jwConfig, this.jobConfiguration)
        );
    }

    public async getResultPersistor(): Promise<IWorkResultPersistor> {
        const dpConfig = this.jobConfiguration.dataPersistorConfig;
        const isDynamicallyImported = dpConfig.type === "dynamic" &&
            dpConfig.importInfo !== undefined;

        return <IWorkResultPersistor>(
            (isDynamicallyImported) ?
                new (await DynamicScriptImporter.importScript(dpConfig.importInfo!)).type(dpConfig) :
                PersistorRegistry.instance.getItem(dpConfig.type, dpConfig, this.jobConfiguration)
        );
    }

    public async parseJobStepDescriptors(): Promise<IJobStep[]> {
        return await Promise.all(
            this.jobConfiguration.jobWorkerConfig.steps.map(
                async (jsd) => {
                    const isDynamicallyImported = jsd.type === "dynamic" && jsd.importInfo !== undefined;
    
                    const step = <IJobStep>((isDynamicallyImported) ?
                        new (await DynamicScriptImporter.importScript(jsd.importInfo!)).type(
                            jsd
                        ) :
                        JobStepRegistry.instance.getItem(jsd.type, jsd, this.jobConfiguration));
    
                    return step;
                }
            )
        );
    }

    public static with(jobConfig: IJobConfiguration): JobPartsParser {
        return new JobPartsParser(jobConfig);
    }
}
