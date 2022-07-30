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

    settings: MentionSettings;

    public async onload() {
        await this.loadSettings();

        this.addAtIcon();
        this.addStyle();

        this.cache = new Cache(this.app.metadataCache, this.app.vault, this.settings);

        this.registerView(VIEW_TYPE_MENTION, (leaf: WorkspaceLeaf) => {
            const mentionView = new MentionView(leaf, this.cache);
            this.cache.subscribe(mentionView.updateView.bind(mentionView));

            return mentionView;
        });

        this.initMentionView();

        this.registerMarkdownPostProcessor((element: HTMLElement) => {
            const previewStyler = new PreviewStyle(element, this.settings);
            previewStyler.addPreviewMentionStyle();
            previewStyler.subscribeToMentionClick(this.previewClickHandler.bind(this));
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
        this.cache.unsubscribeAll();

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

    private async previewClickHandler(text: string) {
        await this.activateMentionView();

        this.app.workspace.getActiveViewOfType(MentionView).selectMentionByKey(text.replace(this.settings.mentionTriggerPhrase, ''));
    }

    private async searchForMention(lineNumber: number, posOnLine: number, path: string) {
        await this.activateMentionView();

        this.app.workspace.getActiveViewOfType(MentionView).selectMentionByKey(this.cache.getMentionAt(path, lineNumber, posOnLine)?.name);
    }

    async activateMentionView() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_MENTION);

        await this.app.workspace.getRightLeaf(false).setViewState({
            type: VIEW_TYPE_MENTION,
            active: true,
        });

        this.app.workspace.revealLeaf(this.app.workspace.getLeavesOfType(VIEW_TYPE_MENTION)[0]);
    }
}
