import { addIcon, MarkdownPostProcessorContext, Plugin, WorkspaceLeaf } from 'obsidian';

import { Cache } from './Cache';
import { getCmDecorationExtension } from './CmDecorationExtension';
import { VIEW_TYPE_MENTION } from './Constants';
import { getAtIcon } from './Icon';
import { MentionPostProcessor as MentionPostProcessor } from './MentionPostProcessor';
import { MentionSuggest } from './MentionSuggest';
import { MentionView } from './MentionView';
import { getMeMentionOrMentionRegex } from './RegExp';
import { DEFAULT_SETTINGS, MentionSettings, MentionSettingsTab, normalizeIgnoredPaths } from './Settings';
import { Style } from './Style';

const x = require('electron');

export default class MentionPlugin extends Plugin {
    private cache: Cache | undefined;
    private style: Style | undefined;

    settings: MentionSettings;

    public async onload() {
        await this.loadSettings();

        // Make sure, that every directory ends with /
        normalizeIgnoredPaths(this.settings);

        this.addAtIcon();
        this.addStyle();

        this.cache = new Cache(this.app.metadataCache, this.app.vault, this.settings);

        this.registerView(VIEW_TYPE_MENTION, (leaf: WorkspaceLeaf) => {
            const mentionView = new MentionView(leaf, this.cache);
            this.cache.subscribeToOccurencesChanges(mentionView.updateList.bind(mentionView));

            return mentionView;
        });

        if (this.app.workspace.layoutReady) {
            this.initAfterLayoutReady();
        } else {
            this.app.workspace.onLayoutReady(async () => {
                this.initAfterLayoutReady();
            });
        }

        this.addSettingTab(new MentionSettingsTab(this.app, this));
    }

    public initAfterLayoutReady() {
        try {
            this.cache.init();
        } catch (e) {
            console.error(e);
        }

        this.initMentionView();

        this.registerMarkdownPostProcessor((element: HTMLElement, ctx: MarkdownPostProcessorContext) => {
            const mentionPostProcessor = new MentionPostProcessor(element, this.settings, ctx);
            mentionPostProcessor.addPreviewMentionStyle();
            mentionPostProcessor.subscribeToMentionClick(this.previewClickHandler.bind(this));
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

        this.registerEditorSuggest(new MentionSuggest(this.app, this.cache, this.settings));
    }

    public initMentionView() {
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE_MENTION).length) return;

        this.app.workspace.getRightLeaf(false).setViewState({
            type: VIEW_TYPE_MENTION,
        });
    }

    public onunload(): void {
        this.cache.unsubscribeAll();
        this.cache.unload();
        // TODO (IMPROVEMENT): Remove classes from opened editor view or close all views

        if (this.style != null) {
            this.style.removeStyle();
        }
        this.app.workspace.getLeavesOfType;
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_MENTION);
    }

    public async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    public async saveSettings() {
        // TODO (IMPROVEMENT): Properly reload MarkdownPreviewProcessor and the CM-Extension. How?
        await this.saveData(this.settings);
        normalizeIgnoredPaths(this.settings);
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
        // TODO (FIX): If we unload and reload the Plugin, the postprocessor is not initialized, so click on a mention throws an error. Reload Editors?
        this.app.workspace.getActiveViewOfType(MentionView).selectMentionByKey(text.replace(this.settings.mentionTriggerPhrase, ''));
    }

    private async searchForMention(lineNumber: number, posOnLine: number, path: string) {
        await this.activateMentionView();
        this.app.workspace.getActiveViewOfType(MentionView).selectMentionByKey(await this.cache.getMentionAt(path, lineNumber, posOnLine));
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
