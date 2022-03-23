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

    public getSuggestions(context: EditorSuggestContext): Completition[] | Promise<Completition[]> {
        const suggestions = this.getMentionSuggestions(context);
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
        const currenCursorPos = activeView.editor.getCursor();
        const replacementValue = value.value + ' ';
        const newCursorPos = { ch: currenCursorPos.ch + replacementValue.length, line: currenCursorPos.line };

        if (!activeView) {
            return;
        }

        activeView.editor.replaceRange(
            replacementValue,
            {
                ch: this.context.start.ch + this.settings.mentionTriggerPhrase.length,
                line: this.context.start.line,
            },
            this.context.end
        );

        activeView.editor.setCursor(newCursorPos);
    }

    private getMentionSuggestions(context: EditorSuggestContext): Completition[] {
        const result: string[] = [];

        for (let key of this.cache.mentions.keys()) {
            if (key.toLocaleLowerCase().contains(context.query.toLocaleLowerCase())) {
                result.push(this.cache.mentions.get(key).name);
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
