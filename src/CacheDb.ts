import Dexie from 'dexie';

import { DB_NAME, DB_VERSION } from './Constants';

export interface IFileHash {
    path: string;
    hash: number;
    mtime: number;
}

export interface IMention {
    name: string;
    isMe: boolean;
    occurencesHash: number;
}

export interface IOccurence {
    mention: string;
    path: string;
    lineFrom: number;
    lineTo: number;
    lineNumber: number;
    startOccurence: number;
    endOccurence: number;
    text: string;
    isTaskComplete: boolean;
}

export class CacheDb extends Dexie {
    // Declare implicit table properties.
    // (just to inform Typescript. Instanciated by Dexie in stores() method)
    mentions!: Dexie.Table<IMention, string>; // string = type of the primkey
    occurences!: Dexie.Table<IOccurence, string>;
    fileHashes!: Dexie.Table<IFileHash, string>;

    constructor() {
        super(DB_NAME);
        this.version(DB_VERSION).stores({
            mentions: 'name',
            occurences: '[path+lineNumber+lineFrom+startOccurence],mention, path',
            fileHashes: 'path',
        });
    }
}
