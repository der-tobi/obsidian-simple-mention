import { Text } from '@codemirror/state';
import { Mutex } from 'async-mutex';
import { EventRef, MetadataCache, Notice, TAbstractFile, TFile, Vault } from 'obsidian';

import { CacheDb, IMention, IOccurence } from './CacheDb';
import { cyrb53Hash } from './cyrb53Hash';
import { getMentionRegExp, TASK_COMPLETE_REG_EXP } from './RegExp';
import { MentionSettings } from './Settings';

class IndexableFile {
    file: TFile;
    fileContent: string;
    hash: number;
    reIndexNecessary: boolean;
}
// Worker Options: https://github.com/blacksmithgu/obsidian-dataview/blob/fea74c37ea981063062a386ede3d5290ef572f26/src/data-import/web-worker/import-manager.ts
// For future improvments see also: https://github.com/blacksmithgu/obsidian-dataview/blob/b2f71814fdb47bdb3a104c7d5a9bbede9c116426/src/data-index/index.ts

// from https://github.com/schemar/obsidian-tasks/blob/main/src/Cache.ts
export class Cache {
    private readonly metadataCacheEventReferences: EventRef[];
    private readonly vaultEventReferences: EventRef[];
    private readonly mutex: Mutex;
    private db: CacheDb;
    private triggerPhraseRegexp: RegExp;
    private occurencesChangeSubscribers: ((mention: IMention, path: string) => void)[] = [];
    private initialized: boolean;

    constructor(private readonly metadataCache: MetadataCache, private readonly vault: Vault, private readonly settings: MentionSettings) {
        this.metadataCacheEventReferences = [];
        this.vaultEventReferences = [];
        this.initialized = false;

        this.mutex = new Mutex();
        this.db = new CacheDb();

        // TODO (FEAT): This does not allow to update the triggerphrase --> memoize and update at the usage?
        this.triggerPhraseRegexp = new RegExp(this.settings.mentionTriggerPhrase);
        // TODO (FEAT): settings Button: for db delet AND db reindexing
    }

    public async init() {
        this.db.open();
        await this.addMeMention();

        this.loadVault();
        this.initialized = true;

        this.subscribeToCache();
        this.subscribeToVault();
    }

    public subscribeToOccurencesChanges(fn: (mention: IMention, path: string) => void): void {
        this.occurencesChangeSubscribers.push(fn);
    }

    public async getAllMentions() {
        return await this.db.mentions.toCollection().primaryKeys();
    }

    public async getMentionAt(path: string, line: number, index: number): Promise<string> {
        const occurenceAt = await this.db.occurences
            .where('path')
            .equals(path)
            .and((o) => o.startOccurence <= index && index < o.endOccurence && o.lineNumber === line)
            .first();
        if (occurenceAt != null) {
            return occurenceAt.mention;
        }
    }

    public async getOccurencesByMention(mention: string) {
        return await this.db.occurences.where('mention').equals(mention).toArray();
    }

    public unsubscribeAll(): void {
        this.occurencesChangeSubscribers = [];
    }

    public unload(): void {
        for (const eventReference of this.metadataCacheEventReferences) {
            this.metadataCache.offref(eventReference);
        }

        for (const eventReference of this.vaultEventReferences) {
            this.vault.offref(eventReference);
        }

        this.db.close();
    }

    private async addMeMention(): Promise<string> {
        const meMention = { name: this.settings.meMentionName, isMe: true } as IMention;
        return this.db.mentions.put(meMention);
    }

    private async loadVault(): Promise<void> {
        return this.mutex.runExclusive(async () => {
            const getIndexableFiles = this.vault.getMarkdownFiles().map((file: TFile) => {
                return this.getIndexableFile(file);
            });

            const indexableFiles = await Promise.all(getIndexableFiles);
            const filesForReindexing = indexableFiles.filter((file) => file.reIndexNecessary);

            const notice = new Notice('Simple Mention:\n', 3600000);
            for (let i = 0; i < filesForReindexing.length; i++) {
                await this.indexFile(filesForReindexing[i]);
                notice.setMessage('Simple Mention:\nIndexing mention ' + (i + 1) + '/' + filesForReindexing.length);
            }

            notice.setMessage('Simple Mention:\nCleaning');
            await this.cleanUpFileHashes(indexableFiles);
            await this.cleanUpWithFileHashes();
            notice.hide();

            new Notice('Simple Mention:\nIndexing done', 1000);
        });
    }

    private subscribeToCache(): void {
        const resolvedEventeReference = this.metadataCache.on('resolved', this.cacheResolvedHandler.bind(this));
        this.metadataCacheEventReferences.push(resolvedEventeReference);

        const changedEventReference = this.metadataCache.on('changed', this.cacheChangedHandler.bind(this));
        this.metadataCacheEventReferences.push(changedEventReference);
    }

    private subscribeToVault(): void {
        const createdEventReference = this.vault.on('create', this.fileCreateHandler.bind(this));
        this.vaultEventReferences.push(createdEventReference);

        const deletedEventReference = this.vault.on('delete', this.fileDeleteHandler.bind(this));
        this.vaultEventReferences.push(deletedEventReference);

        const renamedEventReference = this.vault.on('rename', this.fileRenameHandler.bind(this));
        this.vaultEventReferences.push(renamedEventReference);
    }

    private async getIndexableFile(file: TFile): Promise<IndexableFile> {
        const cachedPageCacheItem = await this.db.fileHashes.get(file.path);
        if (file.stat.mtime === cachedPageCacheItem?.mtime) return { file, hash: null, fileContent: null, reIndexNecessary: false };

        const indexableFile = await this.getIndexableFileBase(file);
        if (cachedPageCacheItem != null && cachedPageCacheItem.hash === indexableFile.hash) {
            (indexableFile as IndexableFile).reIndexNecessary = false;
            return indexableFile as IndexableFile;
        }

        (indexableFile as IndexableFile).reIndexNecessary = true;
        return indexableFile as IndexableFile;
    }

    private async getIndexableFileBase(file: TFile): Promise<Omit<IndexableFile, 'reIndexNecessary'>> {
        const fileContent = await this.vault.read(file);
        const hash = cyrb53Hash(fileContent);

        return { file, fileContent, hash };
    }

    private async indexFile(indexableFile: IndexableFile): Promise<string> {
        const fileLines = indexableFile.fileContent.split('\n');
        const doc = Text.of(fileLines);
        const path = indexableFile.file.path;
        const occurencesOfPath = await this.db.occurences.where('path').equals(path).toArray();
        const mentionsOfPath = await this.db.mentions
            .where('name')
            .anyOfIgnoreCase(occurencesOfPath.map((o) => o.mention))
            .toArray();
        const snapshots = this.getMentionOccurenceSnapshots(mentionsOfPath);
        const matchedMentions: Set<IMention> = new Set();

        await this.removeOccurencesOfPath(path);

        // if the file does not contain a mention, then there is no need to read it further
        if (!indexableFile.fileContent.contains(this.settings.mentionTriggerPhrase)) {
            return this.db.fileHashes.put(
                { path: indexableFile.file.path, hash: indexableFile.hash, mtime: indexableFile.file.stat.mtime },
                indexableFile.file.path
            );
        }

        const matches: { matchArray: RegExpMatchArray; lineNumber: number }[] = [];
        const occurences: IOccurence[] = [];

        fileLines.map((lineContent, lineIndex) => {
            // TODO (FEAT): check if codeblock + settings --> exclude (+suggestion, editor and preview)
            const lineNumber = lineIndex + 1; // With the new editor, the first Line is index 1
            this.getMatches(lineContent).forEach((match) => matches.push({ matchArray: match, lineNumber }));
        });

        await Promise.all(
            matches.map(async (match) => {
                const name = match.matchArray[0].replace(this.triggerPhraseRegexp, '');
                let mention = await this.db.mentions.get(name);
                if (mention == null) {
                    mention = { name, isMe: false } as IMention;
                }

                const occurence: IOccurence = {
                    mention: mention.name,
                    lineFrom: doc.line(match.lineNumber).from,
                    lineTo: doc.line(match.lineNumber).to,
                    lineNumber: match.lineNumber,
                    startOccurence: match.matchArray.index,
                    endOccurence: match.matchArray.index + match.matchArray[0].length,
                    path,
                    text: match.matchArray.input,
                    isTaskComplete: match.matchArray.input.trimStart().match(TASK_COMPLETE_REG_EXP)?.length > 0 || false,
                };

                occurences.push(occurence);
                matchedMentions.add(mention);
            })
        );

        await this.db.occurences.bulkPut(occurences);

        // TODO (IMPROVEMENT): The hash upates, the mention adding and the notification should maybe be done onece for each mention and not on a per file base? Analyze.
        await Promise.all(
            [...matchedMentions.values()].map(async (mention) => {
                const currentOccurences = await this.db.occurences.where('mention').equals(mention.name).toArray();
                const newHash = this.calculateOccurenceHash(currentOccurences);

                mention.occurencesHash = newHash;
            })
        );

        await this.db.mentions.bulkPut([...matchedMentions.values()]);

        matchedMentions.forEach((mention: IMention) => {
            this.handleOccurenceChangeNotification(mention, snapshots.get(mention.name), indexableFile.file.path);
        });

        const deletedMentions = [...mentionsOfPath.values()].filter((mp) => ![...matchedMentions.values()].includes(mp));
        deletedMentions.forEach((mention: IMention) => {
            this.notifyOccurencesChangeSubscribers(mention, path);
        });

        return this.db.fileHashes.put(
            { path: indexableFile.file.path, hash: indexableFile.hash, mtime: indexableFile.file.stat.mtime },
            indexableFile.file.path
        );
    }

    private async cacheResolvedHandler(): Promise<void> {
        // Resolved fires on every change.
        // We only want to initialize if we haven't already.
        if (!this.initialized) {
            this.initialized = true;

            try {
                await this.loadVault();
            } catch (e) {
                console.error(e);
            }
        }
    }

    private cacheChangedHandler(file: TFile): void {
        this.mutex.runExclusive(async () => {
            const indexableFile = await this.getIndexableFile(file);
            if (!indexableFile.reIndexNecessary) return;

            await this.indexFile(indexableFile);
            await this.cleanUpWithFileHashes();
        });
    }

    private async fileCreateHandler(file: TAbstractFile): Promise<void> {
        if (!(file instanceof TFile) || !file.name.endsWith('.md') || file.extension != 'md') return;

        this.mutex.runExclusive(async () => {
            const indexableFile = await this.getIndexableFile(file);
            if (!indexableFile.reIndexNecessary) return;

            await this.indexFile(indexableFile);
        });
    }

    private fileDeleteHandler(file: TAbstractFile): void {
        if (!(file instanceof TFile) || !file.name.toLowerCase().endsWith('.md') || file.extension != 'md') return;

        this.mutex.runExclusive(async () => {
            const affectedMentions = await this.getAffectedMentionsOfPath(file.path);

            await this.removeOccurencesOfPath(file.path);
            await this.cleanUpWithFileHashes();

            affectedMentions.forEach((m) => this.notifyOccurencesChangeSubscribers(m, file.path));
            this.db.fileHashes.delete(file.path);
        });
    }

    private fileRenameHandler(file: TAbstractFile, oldPath: string): void {
        if (!(file instanceof TFile) || !file.name.endsWith('.md') || file.extension != 'md') return;

        this.mutex.runExclusive(async () => {
            const affectedMentions = await this.getAffectedMentionsOfPath(oldPath);

            this.db.occurences.where('path').equals(oldPath).modify({ path: file.path });
            this.db.fileHashes.delete(oldPath);

            affectedMentions.forEach((m) => this.notifyOccurencesChangeSubscribers(m, file.path));

            const indexableFile = await this.getIndexableFile(file);
            this.db.fileHashes.put(
                { path: indexableFile.file.path, hash: indexableFile.hash, mtime: indexableFile.file.stat.mtime },
                indexableFile.file.path
            );
        });
    }

    private getMentionOccurenceSnapshots(mentions: IMention[]): Map<string, number> {
        const mentionOccurencesHashSnapShots = new Map<string, number>();

        mentions.forEach((m) => {
            mentionOccurencesHashSnapShots.set(m.name, m.occurencesHash);
        });

        return mentionOccurencesHashSnapShots;
    }

    private async removeOccurencesOfPath(path: string): Promise<void> {
        await this.db.occurences.where('path').equals(path).delete();
    }

    private getMatches(lineContent: string): RegExpMatchArray[] {
        return [...lineContent.matchAll(getMentionRegExp(this.settings.mentionTriggerPhrase))];
    }

    private calculateOccurenceHash(occurences: IOccurence[]) {
        return cyrb53Hash(JSON.stringify(occurences.map((o) => o.text).sort()));
    }

    private handleOccurenceChangeNotification(mention: IMention, snapshot: number, path: string): void {
        if (snapshot == null || (snapshot != null && snapshot !== mention.occurencesHash)) {
            this.notifyOccurencesChangeSubscribers(mention, path);
        }
    }

    private notifyOccurencesChangeSubscribers(mention: IMention, path: string): void {
        if (this.occurencesChangeSubscribers != null) {
            this.occurencesChangeSubscribers.forEach((fn) => {
                fn(mention, path);
            });
        }
    }

    private async getAffectedMentionsOfPath(path: string): Promise<IMention[]> {
        const affectedOccurences = await this.db.occurences.where('path').equals(path).toArray();
        const distinctMentionNames = affectedOccurences
            .map((o) => o.mention)
            .filter((element, index, array) => array.indexOf(element) === index);

        return this.db.mentions.bulkGet(distinctMentionNames);
    }

    private async cleanUpFileHashes(currentFilesInTheVault: IndexableFile[]): Promise<number> {
        const currentPaths = currentFilesInTheVault.map((file) => file.file.path);
        const pathsOfCachedFiles = (await this.db.fileHashes.orderBy('path').uniqueKeys()) as string[];
        const removedFiles = pathsOfCachedFiles.filter((cachedPath) => !currentPaths.includes(cachedPath));
        return this.db.fileHashes.where('path').anyOf(removedFiles).delete();
    }

    private async cleanUpWithFileHashes(): Promise<void> {
        const pathsOfCachedFiles = (await this.db.fileHashes.orderBy('path').uniqueKeys()) as string[];
        const cachedOccurences = (await this.db.occurences.toArray()).map((o) => [o.path, o.lineNumber, o.lineFrom, o.startOccurence]);
        const occurencesToDelete = cachedOccurences.filter((o) => !pathsOfCachedFiles.includes(o[0] as string));
        // @ts-ignore - we have a compound key, so we need to input an array of arrays
        await this.db.occurences.bulkDelete(occurencesToDelete);

        const currentMentions = (await this.db.occurences.orderBy('mention').uniqueKeys()) as string[];
        const cachedMentions = (await this.db.mentions.toArray()).filter((m) => !m.isMe).map((m) => m.name);
        const mentionsToDelete = cachedMentions.filter((m) => !currentMentions.includes(m));
        return this.db.mentions.bulkDelete(mentionsToDelete);
    }
}
