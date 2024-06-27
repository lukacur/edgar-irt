# Edgar IRT exercises statistics processing and job execution framework project
This project implements the job execution framework and the logic that calculates statistical indicators used for IRT
analysis. This README will go through the configuration and boot up of the IRT adaptive exercises service that was
developed for the _Edgar automated programming assessment system_ for the purposes of the master thesis.

## Database creation
Firstly, you have to have an already present _Edgar_ database. This database will be used by the statistics processing
service to calculate the statistical indicators of questions present in that database. Note that this is __NOT__
required if you only wish to use the job execution framework. Just make sure that all conditions are met for running
the framework correctly.

To work properly, the developed job execution framework has to have a database to store all data related to jobs and
their executions. The SQL script for creating this database is in the `CreateDatabase.sql` script under the
`job_tracking_schema`.

Next step is to establish a database for where the statistics processing job's results will be stored. The SQL script
for creating this database is in the `CreateDatabase.sql` script under the `statistics_schema`. This step can be skipped
if you will only use the job execution framework.

After creating the database environment for the service to run correctly, you can continue to the next sub-chapter.

Note: for the purposes of the developed service, all schemas mentioned in the `CreateDatabase.sql` file are
situated in the _Edgar's_ database.

### <a id="db-cfg"></a> Database configuration
To configure the database that the framework will use, you have to specify the connection arguments in the
`framework-configuration.config.json` file. The file's schema related to database connecting is as follows:
```
{
    databaseConnectivity: {
        host: string;
        port: number;
        database: string;
        schema?: string;
        user: string;
        password: string;

        minConnections?: number;
        maxConnections?: number;
    },
    ...
}
```
The `schema` property can be used to define the default schema for the connection. Since the solution is using
_PostgreSQL_, the default value is `public`. Note that this connection will be used by the _job execution framework_ to
store and get information about jobs.

## Configuring the statistics processing and adaptive grading daemon
After making sure that the required databases are configured correctly, you can proceed in configuring the daemon that
will run the statistics processing logic. To configure the daemon, edit the `adapGrading.config.json` file. The file has
the following schema:
```
{
    resultStalenessInterval: ScanInterval;
    calculationRefreshInterval: ScanInterval;
    recalculationCheckInterval: ScanInterval;
    autoJobStartInfo: {
        interval: ScanInterval;
        jobRequestQueue: string;
        startJobRequest: IStartJobRequest<any>;
        restartIntervalWithNewRequest: boolean;
    };

    maxJobTimeoutMs?: number;

    maxAllowedConcurrentCalculations?: number;

    incomingWorkRequestQueue: QueueDescriptor;
    jobRunnerWorkingQueue: QueueDescriptor;


    calculationConfig: CalculationConfig;
    statisticsCalculationSchemaName: string;
}
```
The upper part in the schema is generic daemon configuration. The lower part is the statistics processing specific
configuration.

<br>

Note: all properties with names ending with an '?' are optional. The '|' symbol means that the final schema can be of
any of the schemas that are on the left and right sides of the '|' symbol.

All the complex types' schemas are listed below:
<ul type="none">
<li>

```
ScanInterval {
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
}
```
</li>
<li>

```
IStartJobRequest<TRequest> {
    readonly idJobType: number;

    readonly jobName?: string | null;
    readonly userNote?: string | null;
    readonly periodical: boolean;
    readonly idUserRequested?: number | null;

    readonly jobMaxTimeoutMs?: number;

    readonly request: TRequest;
}
```
</li>
<li>

```
QueueDescriptor
{
    queueName: string;
    type: "file";
    location: string;
} |
{
    queueName: string;
    type: "dir";
    location: string;

    prefix: string;
    name: string;
    suffix: string;
} |
{
    queueName: string;
    type: "pg_boss";
    connectionString?: string;
    configuration?: IDatabaseConfig;
}
```
</li>
<li>

IDatabase config is the same as in the [Database configuration](#db-cfg) chapter.
</li>
<li>

```
CalculationConfig
{
    useJudge0: true,
    endpoint: string,
    langId: number,
    stdin: string,

    statisticsScriptPath: string,

    authentication?: { header: string, value: string },
    authorization?: { header: string, value: string },
} |
{
    useJudge0: false,
    scriptPath: string,
    outputFile: string,
    generatedJSONInputPath: string,
}
```
</li>
</ul>

After entering the configuration make sure that PgBoss databases referenced in the `incomingWorkRequestQueue` and
`jobRunnerWorkingQueue` queues are up and running. Instructions on how to set up and run a project with PgBoss can be 
found [here](https://github.com/timgit/pg-boss).

<br>

This concludes the configuration process for the framework and the statistics processing service. The following chapter
will describe how to prepare a _Judge0_ instance to properly support running scripts required by the service.

## Configuring Judge0
To correctly create an instance of [Judge0](https://judge0.com/), you should follow instructions on how to create a
docker file of an _Judge0_ instance. In the root folder of the Judge0
[repository](https://gitlab.com/edgar-group/judge0) paste the `Judge0Extension` folder. After building the Dockerfile, 
you can run a new instance of Judge0 with it by following instructions on
[this page](https://github.com/judge0/judge0/releases/tag/v1.13.1). After successfully configuring _Judge0_ you are
ready to start statistics processing jobs.

## Starting the service
To start the service simply run one of the provided NPM scripts:
- `npm run dev` - run in the development environment (with compilation)
- `npm run start` - run in the production environment (without compilation)
- `npm run build` - compile the project

After starting the daemon, it will register listeners on the previously defined `incomingWorkRequestQueue` and
`jobRunnerWorkingQueue` queues depending on their type.

Note that this framework (_job execution framework_) and the
service developed around and with it (_Edgar statistics processing service_) __do not provide an HTPP interface__. The
only interface they have with other applications is through the mentioned queues. However, this does not mean that
integration of an HTTP server is not possible with the _job execution framework_.

For example, a job that you implement can have a step that requires a user to connect to an HTTP server and perform some
actions. This is a valid usage of an _IJobStep_ interface implementation that the framework uses to model job steps.

### Note for Linux users
All custom NPM scripts in this project are adapted for Linux usage. If you want to run a Linux script, add an `-l` to
the end of the script name. For example, if you wish to start the `npm run dev` script on Linux, use the `npm run dev-l`
script instead.

## Developing 'dynamic' implementations for the job execution framework
An example of a 'dynamic' job execution element is provided in the `src/ExamplePersistorPluginScript.ts` file. To check
how the framework handles these files and to get a better understanding of their structure, you can refer to the
`src/PluginSupport/DynamicScriptImporter.ts` and `src\Util\JobPartsParser.ts` source files.

## Plugin support
In future versions.

# Important
<span style="font-size:1.2rem"> __Please note:__ this framework does not have any authentication or authorization
directly built into it. Running an implementation of a service using the framework without implementing any kind of
authentication and/or authorization is prone to security risks. Use at your own risk.
</span>
