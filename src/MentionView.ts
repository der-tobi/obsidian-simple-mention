import { VirtualSelect } from 'node_modules/virtual-select-plugin/src/virtual-select';
import { EventRef, ItemView, MarkdownRenderer, TFile, WorkspaceLeaf } from 'obsidian';

import { Cache } from './Cache';
import { IMention, IOccurence } from './CacheDb';
import { VIEW_TYPE_MENTION } from './Constants';
import { TASK_REG_EXP } from './RegExp';

require('PopoverComponent');
require('PopperComponent');

class SelectOptions {
    label: string;
    value: IMention;
}

export class MentionView extends ItemView {
    // TODO (FEAT): Add indicator if indexing or updating is in progress
    private readonly MENTION_SELECT_ID: string = 'mention-select';
    private readonly MENTION_VIEW_SELECT_CONTAINER: string = 'mention-view-select-container';
    private viewContent: Element;
    private container: HTMLDivElement;
    private controlsContainer: HTMLDivElement;
    private listContainer: HTMLDivElement;
    private mentionSelectValue: string = '';
    private simpleFilterInput: HTMLInputElement;
    private includeCompletedCheckbox: HTMLDivElement;
    private includeCompletedLabel: HTMLDivElement;
    private includeCompleted: boolean = false;
    private onActiveLeafChangeEventRef: EventRef;
    private occurences: IOccurence[] = [];
    private get mentionSelectElement(): any {
        return document.querySelector(`#${this.MENTION_SELECT_ID}`);
    }

    constructor(leaf: WorkspaceLeaf, private readonly cache: Cache) {
        super(leaf);

        this.initRender();

        // Rendering the selection after the placeholder has been rendered if the view did not have the focus yet
        this.onActiveLeafChangeEventRef = this.app.workspace.on('active-leaf-change', (leaf) => {
            if (leaf.view instanceof MentionView) {
                this.renderMentionSelect();
            }
        });

        this.onunload = () => {
            this.app.workspace.offref(this.onActiveLeafChangeEventRef);
        };
    }

    public getViewType(): string {
        return VIEW_TYPE_MENTION;
    }

    public getDisplayText(): string {
        return 'Mention';
    }

    public getIcon(): string {
        return 'at';
    }

    public updateList(mention: IMention, path: string): void {
        if (this.mentionSelectValue === mention.name || this.occurences.map((o) => o.path).includes(path)) {
            this.renderOccurencesList();
        }
    }

    public async selectMentionByKey(key: string): Promise<void> {
        this.app.workspace.revealLeaf(this.leaf);
        await this.renderMentionSelect();
        this.mentionSelectElement.setValue(key);
    }

    private async initRender(): Promise<void> {
        this.renderContainers();
        this.renderControlls();
    }

    private renderContainers(): void {
        this.viewContent = this.containerEl.children[1];
        this.viewContent.empty();
        this.container = this.viewContent.createDiv('mention-view-container');
        this.controlsContainer = this.container.createDiv('mention-view-controls-container');
        this.listContainer = this.container.createDiv('mention-view-list-container');
    }

    private renderControlls() {
        this.controlsContainer.empty();
        this.renderSelectContainer();
        this.renderSimpleFilter();
        this.renderIncludeComplededTasksCheckbox();
    }

    private renderSelectContainer(): void {
        this.controlsContainer.createDiv(this.MENTION_VIEW_SELECT_CONTAINER, (el) => {
            el.id = this.MENTION_VIEW_SELECT_CONTAINER;
        });
    }

    private renderSimpleFilter(): void {
        this.controlsContainer.createDiv('mention-view-simplefilter', (el) => {
            this.simpleFilterInput = document.createElement('input') as HTMLInputElement;
            this.simpleFilterInput.addClass('simplefilter');
            this.simpleFilterInput.setAttr('type', 'text');
            this.simpleFilterInput.placeholder = 'Filter...';

            this.simpleFilterInput.addEventListener('keyup', (ev) => {
                this.renderOccurencesList();
            });

            el.appendChild(this.simpleFilterInput);
        });
    }

    private renderIncludeComplededTasksCheckbox(): void {
        this.controlsContainer.createDiv('mention-view-includeCompleted', (el) => {
            this.includeCompletedLabel = document.createElement('div');
            this.includeCompletedLabel.innerText = 'Include completed tasks';

            this.includeCompletedCheckbox = document.createElement('div');
            this.includeCompletedCheckbox.addClass('checkbox-container');
            this.includeCompletedCheckbox.addEventListener('click', (e) => {
                this.includeCompleted = !this.includeCompleted;
                this.includeCompletedCheckbox.toggleClass('is-enabled', this.includeCompleted);
                this.renderOccurencesList();
            });
            el.appendChild(this.includeCompletedLabel);
            el.appendChild(this.includeCompletedCheckbox);
        });
    }

    private renderOccurencesList(): void {
        this.listContainer.empty();
        this.listContainer.createDiv('mention-view-item-list', async (el) => {
            this.occurences = await this.cache.getOccurencesByMention(this.mentionSelectValue);

            if (this.occurences.length > 0) {
                this.occurences = [
                    ...new Map(
                        this.occurences.map((occurence) => [occurence.path + ':' + occurence.lineFrom + ':' + occurence.lineTo, occurence])
                    ).values(),
                ];
                this.occurences?.sort(this.occurenceComparer).forEach((occurence) => {
                    this.filterAndRenderMentions(occurence, el);
                });
            }

            if (this.occurences.length === 0 && this.mentionSelectValue != '') {
                el.createDiv('mention-view-item-list-empty', (el) => {
                    el.innerText = 'No occurences to show';
                });
            }
        });
    }

    private filterAndRenderMentions(occurence: IOccurence, el: HTMLDivElement): void {
        if (!this.includeCompleted && occurence.isTaskComplete) return;

        if (
            this.simpleFilterInput.value == null ||
            (this.simpleFilterInput.value != null &&
                occurence.text.toLocaleLowerCase().contains(this.simpleFilterInput.value.toLocaleLowerCase()))
        ) {
            this.renderOccurence(el, occurence);
        }
    }

    private renderOccurence(container: HTMLDivElement, occurence: IOccurence): void {
        container.createDiv('mention-view-item', (el) => {
            MarkdownRenderer.renderMarkdown(occurence.text.trimStart(), el, occurence.path, this);
            this.registerTodoCheckboxClick(el, occurence);
            this.registerItemClick(el, occurence);
            el.createDiv('mention-view-item-file', (el) => {
                el.innerText = occurence.path;
            });
        });
    }

    private registerTodoCheckboxClick(el: Element, occurence: IOccurence): void {
        el.getElementsByTagName('input')[0]?.addEventListener('input', async (e) => {
            const separator = '\n';
            const checked = (e.target as HTMLInputElement).checked;
            const file = this.app.vault.getAbstractFileByPath(occurence.path) as TFile;
            const fileContents = await this.app.vault.read(file);
            const fileLines = fileContents.split(separator);

            fileLines[occurence.lineNumber - 1] = fileLines[occurence.lineNumber - 1].replace(TASK_REG_EXP, `${checked ? '[x]' : '[ ]'}`);
            this.app.vault.modify(file, fileLines.join(separator));

            e.stopPropagation();
        });
    }

    private registerItemClick(el: HTMLDivElement, occurence: IOccurence): void {
        el.onClickEvent(async (_) => {
            const file = this.app.vault.getAbstractFileByPath(occurence.path) as TFile;
            const workspace = this.app.workspace;
            const content = await this.app.vault.read(file);

            // TODO (IMPROVEMENT): If the file is already opened in a View, then don't open a new one
            workspace.getLeaf(workspace.getActiveFile() && workspace.getActiveFile().path !== occurence.path).openFile(file, {
                active: true,
                eState: {
                    match: {
                        content,
                        matches: [[occurence.lineFrom + occurence.startOccurence, occurence.lineFrom + occurence.endOccurence]],
                    },
                },
            });
        });
    }

    private async renderMentionSelect() {
        if (document.getElementById(this.MENTION_SELECT_ID) != null) return;

        this.addMentionSelectElement();

        VirtualSelect.init({
            ele: `#${this.MENTION_SELECT_ID}`,
            options: await this.getMentionSelectOptions(),
            search: true,
            markSearchResults: true,
        });

        this.mentionSelectElement.addEventListener('beforeOpen', async () => await this.handleMentionSelectBeforeOpen());
        this.mentionSelectElement.addEventListener('change', () => this.handleMentionSelectChange());
    }

    private addMentionSelectElement(): void {
        const container = document.getElementById(this.MENTION_VIEW_SELECT_CONTAINER);
        const placeholder = container.createDiv();
        placeholder.id = this.MENTION_SELECT_ID;
        container.appendChild(placeholder);
    }

    private async getMentionSelectOptions() {
        const mentions = await this.cache.getAllMentions();

        return mentions
            .map((m) => {
                return { label: m, value: m } as unknown as SelectOptions;
            })
            .sort(this.mentionLabelComparer);
    }

    private async handleMentionSelectBeforeOpen() {
        this.mentionSelectElement.setOptions(await this.getMentionSelectOptions(), true);
    }

    private handleMentionSelectChange(): void {
        const value = this.mentionSelectElement.value;
        this.mentionSelectValue = value != null ? value : '';
        this.renderOccurencesList();
    }

    private occurenceComparer(a: IOccurence, b: IOccurence): number {
        if (a.path === b.path) {
            return a.lineNumber - b.lineNumber;
        }
        return a.path > b.path ? 1 : -1;
    }

    private mentionLabelComparer(a: SelectOptions, b: SelectOptions): number {
        if (a.label.toLowerCase() < b.label.toLowerCase()) {
            return -1;
        }

        if (a.label.toLowerCase() > b.label.toLowerCase()) {
            return 1;
        }

        return 0;
    }
}
