import { App, PluginSettingTab, Setting } from 'obsidian';

import MentionPlugin from './main';

export interface MentionSettings {
    mentionTriggerPhrase: string;
    mentionStyleColor: string;
    meMentionName: string;
    meMentionStyleColor: string;
    ignoredDirectories: string;
}

export const DEFAULT_SETTINGS: MentionSettings = {
    mentionTriggerPhrase: '@',
    mentionStyleColor: 'green',
    meMentionName: 'Me',
    meMentionStyleColor: 'deeppink',
    ignoredDirectories: '',
};

export class MentionSettingsTab extends PluginSettingTab {
    constructor(app: App, private plugin: MentionPlugin) {
        super(app, plugin);
    }

    public display(): void {
        let { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Mention trigger')
            .setDesc('Leave this blank if you want to use the default value (@). Please reload Obsidian after changing this value.')
            .addText((text) => {
                text.setPlaceholder('@');
                text.setValue(this.plugin.settings.mentionTriggerPhrase).onChange((value) => {
                    this.plugin.settings.mentionTriggerPhrase = value;

                    if (value === '') {
                        this.plugin.settings.mentionTriggerPhrase = DEFAULT_SETTINGS.mentionTriggerPhrase;
                    }

                    this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('Mention style color')
            .setDesc('Default/empty is green. You can insert a Hex (#00ff00) or a CSS color (green).')
            .addText((text) => {
                text.setPlaceholder('green');
                text.setValue(this.plugin.settings.mentionStyleColor).onChange((value) => {
                    this.plugin.settings.mentionStyleColor = value;

                    if (value === '') {
                        this.plugin.settings.mentionStyleColor = DEFAULT_SETTINGS.mentionStyleColor;
                    }

                    this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('Mention yourself')
            .setDesc('Default/empty is "Me" (@Me). Please reload Obsidian after changing this value.')
            .addText((text) => {
                text.setPlaceholder('Me');
                text.setValue(this.plugin.settings.meMentionName).onChange((value) => {
                    this.plugin.settings.meMentionName = value;

                    if (value === '') {
                        this.plugin.settings.meMentionName = DEFAULT_SETTINGS.meMentionName;
                    }

                    this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('Mention yourself style color')
            .setDesc('Default/empty is deeppink. You can insert a Hex (#FF1493) or a CSS color (deeppink).')
            .addText((text) => {
                text.setPlaceholder('deeppink');
                text.setValue(this.plugin.settings.meMentionStyleColor).onChange((value) => {
                    this.plugin.settings.meMentionStyleColor = value;

                    if (value === '') {
                        this.plugin.settings.meMentionStyleColor = DEFAULT_SETTINGS.meMentionStyleColor;
                    }

                    this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
        .setName('Ignored directories')
        .setDesc('List of directories to ignore (separated by comma). Please reload Obsidian after changing this value.')
        .addText((text) => {
            text.setValue(this.plugin.settings.ignoredDirectories).onChange((value) => {
                this.plugin.settings.ignoredDirectories = value;

                if (value === '') {
                    this.plugin.settings.ignoredDirectories = DEFAULT_SETTINGS.ignoredDirectories;
                }

                this.plugin.saveSettings();
            });
        });
    }
}
