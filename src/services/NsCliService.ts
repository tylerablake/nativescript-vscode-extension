import {spawn, execSync, ChildProcess} from 'child_process';
import * as fs from 'fs';
import {EventEmitter} from 'events';
import * as path from 'path';
import * as https from 'https';
import {Version} from './version';
import {Logger, Handlers, Tags} from '../services/Logger';
import {Services} from '../services/services/services';
import {ExtensionVersionService} from './ExtensionVersionService';
import {DebugProtocol} from 'vscode-debugprotocol';

export enum CliVersionState {
    NotExisting,
    OlderThanSupported,
    Compatible
}

export class CliVersionInfo {
    private static installedCliVersion: Version = null;

    private _state: CliVersionState;

    public static getInstalledCliVersion(): Version {
        if (this.installedCliVersion === null) {
            // get the currently installed CLI version
            let getVersionCommand: string = new CommandBuilder().appendParam('--version').buildAsString(); // tns --version
            try {
                let versionStr: string = execSync(getVersionCommand).toString().trim(); // execute it
                this.installedCliVersion = versionStr ? Version.parse(versionStr) : null; // parse the version string
            } catch(e) {
                this.installedCliVersion = null;
            }
        }

        return this.installedCliVersion;
    }

    private static getMinNativeScriptCliVersionSupported(): Version {
        return Version.parse(require('../../package.json').minNativescriptCliVersion);
    }

    constructor() {
        let installedCliVersion: Version = CliVersionInfo.getInstalledCliVersion();
        if (installedCliVersion === null) {
            this._state = CliVersionState.NotExisting;
        }
        else {
            let minSupportedCliVersion = CliVersionInfo.getMinNativeScriptCliVersionSupported();
            this._state = installedCliVersion.compareBySubminorTo(minSupportedCliVersion) < 0 ? CliVersionState.OlderThanSupported : CliVersionState.Compatible;
        }
    }

    public getState(): CliVersionState {
        return this._state;
    }

    public isCompatible(): boolean {
        return this._state === CliVersionState.Compatible;
    }

    public getErrorMessage(): string {
        switch (this._state) {
            case CliVersionState.NotExisting:
                return `NativeScript CLI not found, please run 'npm -g install nativescript' to install it.`;
            case CliVersionState.OlderThanSupported:
                return `The existing NativeScript extension is compatible with NativeScript CLI v${CliVersionInfo.getMinNativeScriptCliVersionSupported()} or greater. The currently installed NativeScript CLI is v${CliVersionInfo.getInstalledCliVersion()}. You can update the NativeScript CLI by executing 'npm install -g nativescript'.`;
            default:
                return null;
        }
    }
}

export abstract class NSProject extends EventEmitter {
    private _projectPath: string;
    private _cliVersionInfo: CliVersionInfo;

    constructor(projectPath: string, tnsOutputFilePath?: string) {
        super();
        this._projectPath = projectPath;
        this._cliVersionInfo = new CliVersionInfo();
    }

    public getProjectPath(): string {
        return this._projectPath;
    }

    public getCliVersionInfo() {
        return this._cliVersionInfo;
    }

    public abstract platform(): string;

    public abstract run(): Promise<ChildProcess>;

    public abstract debug(args: DebugProtocol.IRequestArgs): Promise<any>;

    protected spawnProcess(commandPath: string, commandArgs: string[], tnsOutput?: string): ChildProcess {
        let options = { cwd: this.getProjectPath(), shell: true };
        let child: ChildProcess = spawn(commandPath, commandArgs, options);
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        return child;
    }
}

export class IosProject extends NSProject {

    constructor(projectPath: string, tnsOutputFilePath?: string) {
        super(projectPath, tnsOutputFilePath);
    }

    public platform(): string {
        return 'ios';
    }

    public run(): Promise<ChildProcess> {
        if (!this.isOSX()) {
            return Promise.reject('iOS platform is only supported on OS X.');
        }

        // build command to execute
        let command = new CommandBuilder()
            .appendParam("run")
            .appendParam(this.platform())
            .build();

        let child: ChildProcess = this.spawnProcess(command.path, command.args);
        return Promise.resolve(child);
    }

    public debug(args: DebugProtocol.IRequestArgs): Promise<string> {
        if (!this.isOSX()) {
            return Promise.reject('iOS platform is supported only on OS X.');
        }

        let rebuild = (args.request == "launch") ? (args as DebugProtocol.ILaunchRequestArgs).rebuild : true;
        // build command to execute
        let command = new CommandBuilder(args.nativescriptCliPath)
            .appendParam("debug")
            .appendParam(this.platform())
            .appendParamIf("--start", args.request === "attach")
            .appendParamIf("--debug-brk", args.request === "launch" && (args as DebugProtocol.ILaunchRequestArgs).stopOnEntry)
            .appendParamIf("--no-rebuild", !rebuild)
            .appendParamIf("--syncAllFiles", args.request === "launch" && !rebuild && (args as DebugProtocol.ILaunchRequestArgs).syncAllFiles)
            .appendParam("--no-client")
            .appendParams(args.tnsArgs)
            .build();

        let socketPathPrefix = 'socket-file-location: ';
        let socketPathPattern: RegExp = new RegExp(socketPathPrefix + '.*\.sock');

        let isSocketOpened = (cliOutput: string): string => {
            let matches: RegExpMatchArray = cliOutput.match(socketPathPattern);
            if(matches && matches.length > 0) {
                return matches[0].substr(socketPathPrefix.length);
            }
            return null;
        };

        let isAppSynced = (cliOutput: string) => {
            return cliOutput.indexOf('Successfully synced application') > -1;
        };

        return new Promise<string>((resolve, reject) => {
            // run NativeScript CLI command
            let child: ChildProcess = this.spawnProcess(command.path, command.args, args.tnsOutput);

            let appSynced = false;
            let socketPath: string = null;

            child.stdout.on('data', (data) => {
                let cliOutput: string = data.toString();
                Services.logger.log(cliOutput, Tags.FrontendMessage);

                socketPath = socketPath || isSocketOpened(cliOutput);
                appSynced = rebuild ? false : (appSynced || isAppSynced(cliOutput));

                if ((rebuild && socketPath) || (!rebuild && socketPath && appSynced)) {
                    resolve(socketPath);
                }
            });

            child.stderr.on('data', (data) => {
                Services.logger.error(data.toString(), Tags.FrontendMessage);
            });

            child.on('close', (code, signal) => {
                reject("The debug process exited unexpectedly code:" + code);
            });
        });
    }

    private isOSX(): boolean {
        return /^darwin/.test(process.platform);
    }
}

export class AndroidProject extends NSProject {

    constructor(projectPath: string, tnsOutputFilePath?: string) {
        super(projectPath, tnsOutputFilePath);
    }

    public platform(): string {
        return 'android';
    }

    public run(): Promise<ChildProcess> {
        // build command to execute
        let command = new CommandBuilder()
            .appendParam("run")
            .appendParam(this.platform())
            .build();

        let child: ChildProcess = this.spawnProcess(command.path, command.args);
        return Promise.resolve(child);
    }

    public debug(params: DebugProtocol.IRequestArgs): Promise<void> {
        if (params.request === "attach") {
            return Promise.resolve<void>();
        }
        else if (params.request === "launch") {
            let args: DebugProtocol.ILaunchRequestArgs = params as DebugProtocol.ILaunchRequestArgs;
            let that = this;
            let launched = false;

            return new Promise<void>((resolve, reject) => {
                let command = new CommandBuilder(args.nativescriptCliPath)
                    .appendParam("debug")
                    .appendParam(this.platform())
                    .appendParamIf("--no-rebuild", args.rebuild !== true)
                    .appendParamIf("--debug-brk", args.stopOnEntry)
                    .appendParam("--no-client")
                    .appendParams(args.tnsArgs)
                    .build();

                Services.logger.log("tns  debug command: " + command);

                // run NativeScript CLI command
                let child: ChildProcess = this.spawnProcess(command.path, command.args, args.tnsOutput);
                child.stdout.on('data', function(data) {
                    let strData: string = data.toString();
                    Services.logger.log(data.toString(), Tags.FrontendMessage);
                    if (!launched) {
                         if (args.request === "launch" && strData.indexOf('# NativeScript Debugger started #') > -1) {
                             launched = true;
                             //wait a little before trying to connect, this gives a changes for adb to be able to connect to the debug socket
                             setTimeout(() => {
                                 resolve();
                             }, 500);
                         }
                    }
                });

                child.stderr.on('data', function(data) {
                    Services.logger.error(data.toString(), Tags.FrontendMessage);
                });

                child.on('close', function(code) {
                    if (!args.rebuild) {
                         setTimeout(() => {
                          reject("The debug process exited unexpectedly code:" + code);
                        }, 3000);
                    }
                    else {
                        reject("The debug process exited unexpectedly code:" + code);
                    }
                });
            });
         }
    }

    public getDebugPort(args: DebugProtocol.IRequestArgs): Promise<number> {
        //TODO: Call CLI to get the debug port
        //return Promise.resolve(40001);

        //return Promise.resolve(40001);

        let command = new CommandBuilder(args.nativescriptCliPath)
            .appendParam("debug")
            .appendParam(this.platform())
            .appendParam("--get-port")
            .appendParams(args.tnsArgs)
            .build();
        let that = this;
        // run NativeScript CLI command
        return new Promise<number>((resolve, reject) => {
            let child: ChildProcess = this.spawnProcess(command.path, command.args, args.tnsOutput);

            child.stdout.on('data', function(data) {
                Services.logger.log(data.toString(), Tags.FrontendMessage);

                let regexp = new RegExp("(?:debug port: )([\\d]{5})");

                //for the new output
                // var input = "device: 030b258308e6ce89 debug port: 40001";

                let portNumberMatch = null;
                let match = data.toString().match(regexp);
                if (match)
                {
                    portNumberMatch = match[1];
                }

                if (portNumberMatch) {
                    Services.logger.log("port number match '" + portNumberMatch + "'");
                    let portNumber = parseInt(portNumberMatch);
                    if (portNumber) {
                        Services.logger.log("port number " + portNumber);
                        child.stdout.removeAllListeners('data');
                        resolve(portNumber);
                    }
                }
            });

            child.stderr.on('data', function(data) {
                Services.logger.error(data.toString(), Tags.FrontendMessage);
            });

            child.on('close', function(code) {
                reject("Getting debug port failed with code: " + code);
            });
        });
    }
}

class CommandBuilder {

    private _tnsPath: string;
    private _command: string[] = [];

    constructor(tnsPath?: string) {
        this._tnsPath =  tnsPath || "tns";
    }

    public appendParam(parameter: string): CommandBuilder {
        this._command.push(parameter);
        return this;
    }

    public appendParams(parameters: string[] = []): CommandBuilder {
        parameters.forEach(param => this.appendParam(param));
        return this;
    }

    public appendParamIf(parameter: string, condtion: boolean): CommandBuilder {
        if (condtion) {
            this._command.push(parameter);
        }
        return this;
    }

    public build(): { path: string, args: string[] } {
        return { path: this._tnsPath, args: this._command };
    }

    public buildAsString(): string {
        let result = this.build();
        return `${result.path} ` + result.args.join(' ');
    }
}
