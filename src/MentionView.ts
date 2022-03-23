import { ItemView, MarkdownRenderer, TFile, WorkspaceLeaf } from 'obsidian';

import { Cache } from './Cache';
import { VIEW_TYPE_MENTION } from './Constants';
import { Mention, Occurence } from './Mention';
import { TASK_REG_EXP } from './RegExp';

export class MentionView extends ItemView {
    private viewContent: Element;
    private container: HTMLDivElement;
    private controlsContainer: HTMLDivElement;
    private listContainer: HTMLDivElement;
    private mentionSelect: string = '';
    private select: HTMLSelectElement;
    private simpleFilterInput: HTMLInputElement;
    private includeCompletedCheckbox: HTMLDivElement;
    private includeCompletedLabel: HTMLDivElement;
    private includeCompleted: boolean = false;
    private options: HTMLOptionElement[] = [];
    private readonly mentions: Map<string, Mention>;

    constructor(leaf: WorkspaceLeaf, private readonly cache: Cache) {
        super(leaf);
        this.mentions = cache.mentions;
        this.cache.loadVault();
        this.initRender();
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
    public updateView(): void {
        this.renderOptions();
        this.renderList();
    }

    public selectMentionByKey(key: string): void {
        const option = this.options.find((o) => o.value === key);

        if (option != null) {
            option.selected = true;
            this.mentionSelect = option.value;
            this.renderList();
        }

        this.app.workspace.revealLeaf(this.leaf);
    }

    private initRender(): void {
        this.renderContainers();
        this.renderSelect();
        this.renderSimpleFilter();
        this.renderIncludeComplededTasksCheckbox();
        this.renderOptions();
        this.renderList();
    }

    private renderContainers(): void {
        this.viewContent = this.containerEl.children[1];
        this.viewContent.empty();
        this.container = this.viewContent.createDiv('mention-view-container');
        this.controlsContainer = this.container.createDiv('mention-view-controls-container');
        this.listContainer = this.container.createDiv('mention-view-list-container');
    }

    private renderSelect(): void {
        this.controlsContainer.empty();
        this.controlsContainer.createDiv('mention-view-select', (el) => {
            this.select = document.createElement('select') as HTMLSelectElement;
            this.select.addClass('dropdown');

            this.select.addEventListener('change', (ev) => {
                this.mentionSelect = (ev.target as HTMLSelectElement).value;
                this.renderList();
            });

            el.appendChild(this.select);
        });
    }

    private renderSimpleFilter(): void {
        this.controlsContainer.createDiv('mention-view-simplefilter', (el) => {
            this.simpleFilterInput = document.createElement('input') as HTMLInputElement;
            this.simpleFilterInput.addClass('simplefilter');
            this.simpleFilterInput.setAttr('type', 'text');
            this.simpleFilterInput.placeholder = 'Filter...';

            this.simpleFilterInput.addEventListener('keyup', (ev) => {
                this.renderList();
            });

            el.appendChild(this.simpleFilterInput);
        });
    }

    private renderIncludeComplededTasksCheckbox(): void {
        this.controlsContainer.createDiv('mention-view-includeCompleted', (el) => {
            this.includeCompletedLabel = document.createElement('div');
            this.includeCompletedLabel.innerHTML = 'Include completed tasks';

            this.includeCompletedCheckbox = document.createElement('div');
            this.includeCompletedCheckbox.addClass('checkbox-container');
            this.includeCompletedCheckbox.addEventListener('click', (e) => {
                this.includeCompleted = !this.includeCompleted;
                this.includeCompletedCheckbox.toggleClass('is-enabled', this.includeCompleted);
                this.renderList();
            });
            el.appendChild(this.includeCompletedLabel);
            el.appendChild(this.includeCompletedCheckbox);
        });
    }

    private renderOptions(): void {
        this.select.empty();
        this.options = [];

        const emptyOption = document.createElement('option');
        emptyOption.value = 'Select all @mentions';
        emptyOption.text = 'Select all @mentions';
        emptyOption.selected = this.mentionSelect == 'Select all @mentions';
        this.options.push(emptyOption);
        this.select.appendChild(emptyOption);

        const keys = [...this.mentions.keys()];
        keys.sort(this.mentionLabelComparer).forEach((key) => {
            const value = this.mentions.get(key);
            const option = document.createElement('option');
            option.value = key;
            option.text = value.name;
            option.selected = this.mentionSelect == key;
            this.options.push(option);
            this.select.appendChild(option);
        });
    }

    private renderList(): void {
        this.listContainer.empty();
        this.listContainer.createDiv('mention-view-item-list', (el) => {
            if (this.mentions != null) {
                const selectedMention = this.mentions.get(this.mentionSelect);

                if (this.select.value === 'Select all @mentions') {
                    [...this.mentions?.values()]
                        .flatMap((m) => m.occurences)
                        ?.sort(this.occurenceComparer)
                        .forEach((occurence) => {
                            this.filterAndRenderMentions(occurence, el);
                        });
                } else if (selectedMention?.occurences.length > 0) {
                    selectedMention.occurences?.sort(this.occurenceComparer).forEach((occurence) => {
                        this.filterAndRenderMentions(occurence, el);
                    });
                }
            }
        });
    }

    private filterAndRenderMentions(occurence: Occurence, el: HTMLDivElement): void {
        if (!this.includeCompleted && occurence.isTaskComplete) {
            return;
        }

        if (
            this.simpleFilterInput.value == null ||
            (this.simpleFilterInput.value != null &&
                occurence.text.toLocaleLowerCase().contains(this.simpleFilterInput.value.toLocaleLowerCase()))
        ) {
            this.renderOccurence(el, occurence);
        }
    }

    private renderOccurence(container: HTMLDivElement, occurence: Occurence): void {
        container.createDiv('mention-view-item', (el) => {
            MarkdownRenderer.renderMarkdown(occurence.text.trimStart(), el, occurence.path, this);
            this.registerTodoCheckboxClick(el, occurence);
            this.registerItemClick(el, occurence);
            el.createDiv('mention-view-item-file', (el) => {
                el.innerHTML = occurence.path;
            });
        });
    }

    private occurenceComparer(a: Occurence, b: Occurence): number {
        if (a.path === b.path) {
            return a.line.number - b.line.number;
        }
        return a.path > b.path ? 1 : -1;
    }

    private mentionLabelComparer(a: string, b: string): number {
        if (a.toLowerCase() < b.toLowerCase()) {
            return -1;
        }

        if (a.toLowerCase() > b.toLowerCase()) {
            return 1;
        }

        return 0;
    }

    private registerTodoCheckboxClick(el: Element, occurence: Occurence): void {
        el.getElementsByTagName('input')[0]?.addEventListener('input', (e) => {
            const separator = '\n';
            const checked = (e.target as HTMLInputElement).checked;
            const file = this.app.vault.getAbstractFileByPath(occurence.path) as TFile;
            const fileContents = this.app.vault.read(file);

            fileContents.then((content) => {
                const fileLines = content.split(separator);
                fileLines[occurence.line.number - 1] = fileLines[occurence.line.number - 1].replace(
                    TASK_REG_EXP,
                    `${checked ? '[x]' : '[ ]'}`
                );

                this.app.vault.modify(file, fileLines.join(separator));
            });
            e.stopPropagation();
        });
    }

    private registerItemClick(el: HTMLDivElement, occurence: Occurence): void {
        el.onClickEvent((_) => {
            const file = this.app.vault.getAbstractFileByPath(occurence.path) as TFile;
            const workspace = this.app.workspace;

            this.app.vault.read(file).then((content) => {
                if (workspace.getActiveFile() && workspace.getActiveFile().path !== occurence.path) {
                    workspace.splitActiveLeaf().openFile(file, {
                        active: true,
                        eState: {
                            match: {
                                content,
                                matches: [[occurence.line.from + occurence.startOccurence, occurence.line.from + occurence.endOccurence]],
                            },
                        },
                    });
                } else {
                    workspace.getUnpinnedLeaf().openFile(file, {
                        active: true,
                        eState: {
                            match: {
                                content,
                                matches: [[occurence.line.from + occurence.startOccurence, occurence.line.from + occurence.endOccurence]],
                            },
                        },
                    });
                }
            });
        });
    }
}
