import {
    App,
    Editor,
    EditorPosition,
    EditorSuggest,
    EditorSuggestContext,
    EditorSuggestTriggerInfo,
    MarkdownView,
    TFile,
} from 'obsidian';

import { Cache } from './Cache';
import { isFilePathInIgnoredDirectories } from './IgnoreHelper';
import { MENTION_SUGGEST_REG_EXP } from './RegExp';
import { MentionSettings } from './Settings';

interface Completition {
    label: string;
    value: string;
}

export class MentionSuggest extends EditorSuggest<Completition> {
    constructor(private app: App, private cache: Cache, private settings: MentionSettings) {
        super(app);
    }

    public onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo {
        if (isFilePathInIgnoredDirectories(file.path, this.settings)) return;

        const line = editor.getLine(cursor.line).substring(0, cursor.ch);

        if (!line.contains(this.settings.mentionTriggerPhrase)) {
            return;
        }

        const currentPart = line.split(this.settings.mentionTriggerPhrase).reverse()[0];
        const currentStart = [...line.matchAll(new RegExp(this.settings.mentionTriggerPhrase, 'g'))].reverse()[0].index;

        // Don't allow the email pattern and enforce a space before a mention
        if (line.slice(currentStart - 1, currentStart) !== ' ' && line.slice(currentStart - 1, currentStart) !== '') {
            return;
        }

        if (!MENTION_SUGGEST_REG_EXP.test(currentPart)) {
            return;
        }

        const result = {
            start: {
                ch: currentStart,
                line: cursor.line,
            },
            end: cursor,
            query: currentPart,
        };

        return result;
    }

    public async getSuggestions(context: EditorSuggestContext): Promise<Completition[]> {
        const suggestions = await this.getMentionSuggestions(context);
        if (suggestions.length) {
            return suggestions.sort(this.completitionComparer);
        }

        return [{ label: context.query, value: context.query }].sort(this.completitionComparer);
    }

    public renderSuggestion(value: Completition, el: HTMLElement): void {
        el.setText(value.label);
    }

    public selectSuggestion(value: Completition, evt: MouseEvent | KeyboardEvent): void {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const replacementValue = value.value + ' ';

        if (!activeView) return;

        activeView.editor.replaceRange(
            replacementValue,
            {
                ch: this.context.start.ch + this.settings.mentionTriggerPhrase.length,
                line: this.context.start.line,
            },
            this.context.end
        );

        activeView.editor.setCursor({
            ch: this.context.start.ch + this.settings.mentionTriggerPhrase.length + replacementValue.length,
            line: this.context.start.line,
        });
    }

    private async getMentionSuggestions(context: EditorSuggestContext): Promise<Completition[]> {
        const result: string[] = [];

        for (let mention of await this.cache.getAllMentions()) {
            // for (let key of this.cache.mentions.keys()) {
            if (mention.toLocaleLowerCase().contains(context.query.toLocaleLowerCase())) {
                result.push(mention);
            }
        }

        return result.map((r) => ({ label: r.replace(/["]/g, ''), value: r }));
    }

    private completitionComparer(a: Completition, b: Completition): number {
        if (a.label.toLowerCase() < b.label.toLowerCase()) {
            return -1;
        }

        if (a.label.toLowerCase() > b.label.toLowerCase()) {
            return 1;
        }

        return 0;
    }
}
