import { Text } from '@codemirror/state';
import { Mutex } from 'async-mutex';
import { EventRef, MetadataCache, TAbstractFile, TFile, Vault } from 'obsidian';
import { Mention } from 'src/Mention';

import { getMentionRegExp, TASK_COMPLETE_REG_EXP } from './RegExp';
import { MentionSettings } from './Settings';

// from https://github.com/schemar/obsidian-tasks/blob/main/src/Cache.ts
export class Cache {
    private readonly metadataCacheEventReferences: EventRef[];
    private readonly vaultEventReferences: EventRef[];
    private readonly mutex: Mutex;

    private subscribers: (() => void)[] = [];

    /**
     * We cannot know if this class will be instantiated because obsidian started
     * or because the plugin was activated later. This means we have to load the
     * whole vault once after the first metadata cache resolve to ensure that we
     * load the entire vault in case obsidian is starting up. In the case of
     * obsidian starting, the mentions cache's initial load would end up with 0 mentions,
     * as the metadata cache would still be empty.
     */
    private loadedAfterFirstResolve: boolean;
    mentions: Map<string, Mention>;

    constructor(private readonly metadataCache: MetadataCache, private readonly vault: Vault, private readonly settings: MentionSettings) {
        this.metadataCacheEventReferences = [];
        this.vaultEventReferences = [];
        this.mentions = new Map();
        this.mutex = new Mutex();
        this.loadedAfterFirstResolve = false;

        this.addMeMention();
        this.subscribeToCache();
        this.subscribeToVault();
    }

    public getMentionAt(path: string, line: number, index: number): Mention {
        for (let mention of this.mentions.values()) {
            if (mention.hasOccurenceAt(path, line, index)) {
                return mention;
            }
        }
    }

    public subscribe(fn: () => void): void {
        this.subscribers.push(fn);
    }

    public loadVault(): Promise<void> {
        return this.mutex.runExclusive(async () => {
            await Promise.all(
                this.vault.getMarkdownFiles().map((file: TFile) => {
                    return this.indexFile(file);
                })
            );
        });
    }

    private addMeMention(): void {
        const meMention = new Mention('Me', true);
        this.mentions.set(meMention.name, meMention);
    }

    private subscribeToCache(): void {
        const resolvedEventeReference = this.metadataCache.on('resolved', async () => {
            // Resolved fires on every change.
            // We only want to initialize if we haven't already.
            if (!this.loadedAfterFirstResolve) {
                this.loadedAfterFirstResolve = true;
                await this.loadVault();
            }
        });

        this.metadataCacheEventReferences.push(resolvedEventeReference);

        // Does not fire when starting up obsidian and only works for changes.
        const changedEventReference = this.metadataCache.on('changed', (file: TFile) => {
            this.mutex.runExclusive(() => {
                this.indexFile(file);
            });
        });

        this.metadataCacheEventReferences.push(changedEventReference);
    }

    private subscribeToVault(): void {
        const createdEventReference = this.vault.on('create', (file: TAbstractFile) => {
            if (!(file instanceof TFile)) {
                return;
            }

            this.mutex.runExclusive(() => {
                this.indexFile(file);
            });
        });

        this.vaultEventReferences.push(createdEventReference);

        const deletedEventReference = this.vault.on('delete', (file: TAbstractFile) => {
            if (!(file instanceof TFile)) {
                return;
            }

            this.mutex.runExclusive(() => {
                this.removeCurrentPathFromAllMentions(file.path);
            });
        });

        this.vaultEventReferences.push(deletedEventReference);

        const renamedEventReference = this.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
            if (!(file instanceof TFile)) {
                return;
            }

            this.mutex.runExclusive(() => {
                this.mentions.forEach((mention) => {
                    mention.updatePath(oldPath, file.path);
                });
            });
        });

        this.vaultEventReferences.push(renamedEventReference);
    }

    private async indexFile(file: TFile): Promise<void> {
        const fileContent = await this.vault.cachedRead(file);
        const fileLines = fileContent.split('\n');
        const doc = Text.of(fileLines);
        const path = file.path;

        this.removeCurrentPathFromAllMentions(path);

        fileLines.forEach((lineContent, lineIndex) => {
            const matches = this.getMatches(lineContent);
            const lineNumber = lineIndex + 1; // With the new editor, the first Line is index 1

            matches.forEach((match) => {
                const mention = this.addToMentions(match);
                const occurence = {
                    line: doc.line(lineNumber),
                    startOccurence: match.index,
                    endOccurence: match.index + match[0].length,
                    path,
                    text: match.input,
                    isTaskComplete: match.input.trimStart().match(TASK_COMPLETE_REG_EXP)?.length > 0 || false,
                };
                mention.addOccurence(occurence);
            });
        });

        this.notifySubscribers();
    }

    private notifySubscribers(): void {
        if (this.subscribers != null) {
            this.subscribers.forEach((fn) => {
                fn();
            });
        }
    }

    private removeCurrentPathFromAllMentions(path: string): void {
        this.mentions.forEach((mention) => {
            mention.removeAllOccurencesOfPath(path);

            if (!mention.isMentioned && !mention.isMe) {
                this.mentions.delete(mention.name);
            }
        });
    }

    private getMatches(lineContent: string): RegExpMatchArray[] {
        return [...lineContent.matchAll(getMentionRegExp(this.settings.mentionTriggerPhrase))];
    }

    private addToMentions(match: RegExpMatchArray): Mention {
        const name = match[0].replace(new RegExp(this.settings.mentionTriggerPhrase), '');
        let mention = this.mentions.get(name);

        if (!mention) {
            mention = new Mention(name);
            this.mentions.set(name, mention);
        }

        return mention;
    }
}
