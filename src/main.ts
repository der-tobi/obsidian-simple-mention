import { addIcon, Plugin, WorkspaceLeaf } from 'obsidian';

import { Cache } from './Cache';
import { getCmDecorationExtension } from './CmDecorationExtension';
import { VIEW_TYPE_MENTION } from './Constants';
import { getAtIcon } from './Icon';
import { MentionSuggest } from './MentionSuggest';
import { MentionView } from './MentionView';
import { PreviewStyle } from './PreviewStyle';
import { getMeMentionOrMentionRegex } from './RegExp';
import { DEFAULT_SETTINGS, MentionSettings, MentionSettingsTab } from './Settings';
import { Style } from './Style';

export default class MentionPlugin extends Plugin {
    private cache: Cache | undefined;
    private style: Style | undefined;

    mentionView: MentionView;
    settings: MentionSettings;

    public async onload() {
        await this.loadSettings();

        this.addAtIcon();
        this.addStyle();

        this.cache = new Cache(this.app.metadataCache, this.app.vault, this.settings);

        this.initMentionView();

        this.registerMarkdownPostProcessor((element: HTMLElement) => {
            const previewStyler = new PreviewStyle(element, this.settings);
            previewStyler.addPreviewMentionStyle();
            previewStyler.subscribeToMentionClick(this.previewClickHanlder.bind(this));
        });

        this.registerEditorExtension(
            getCmDecorationExtension(
                this.app,
                {
                    regexp: getMeMentionOrMentionRegex(this.settings.mentionTriggerPhrase, this.settings.meMentionName),
                    keyDownHandler: this.searchForMention.bind(this),
                    mouseDownHandler: this.searchForMention.bind(this),
                },
                this.settings
            )
        );

        this.addSettingTab(new MentionSettingsTab(this.app, this));
        this.registerEditorSuggest(new MentionSuggest(this.app, this.cache, this.settings));
    }

    public initMentionView() {
        this.registerView(VIEW_TYPE_MENTION, (leaf: WorkspaceLeaf) => {
            this.mentionView = new MentionView(leaf, this.cache);
            this.cache.subscribe(this.mentionView.updateView.bind(this.mentionView));

            return this.mentionView;
        });

        this.app.workspace.onLayoutReady(() => {
            if (this.app.workspace.getLeavesOfType(VIEW_TYPE_MENTION).length) {
                return;
            }
            this.app.workspace.getRightLeaf(false).setViewState({
                type: VIEW_TYPE_MENTION,
            });
        });
    }

    public onunload(): void {
        if (this.style != null) {
            this.style.removeStyle();
        }
        this.app.workspace.getLeavesOfType(VIEW_TYPE_MENTION).forEach((leaf) => leaf.detach());
    }

    public async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    public async saveSettings() {
        // TODO: Properly reload MarkdownPreviewProcessor and the CM-Extension. How?
        await this.saveData(this.settings);
        this.style.updateStyle();
    }

    private addAtIcon() {
        const atIcon = getAtIcon();
        addIcon(atIcon.iconId, atIcon.svgContent);
    }

    private addStyle() {
        this.style = new Style(this.settings);
        this.style.appendStyle();
    }

    private previewClickHanlder(text: string) {
        this.mentionView.selectMentionByKey(text.replace(this.settings.mentionTriggerPhrase, ''));
    }

    private searchForMention(lineNumber: number, posOnLine: number, path: string) {
        const mention = this.cache.getMentionAt(path, lineNumber, posOnLine);
        this.mentionView.selectMentionByKey(mention.name);
    }
}
