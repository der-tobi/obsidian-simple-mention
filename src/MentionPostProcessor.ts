import { MarkdownPostProcessorContext } from 'obsidian';

import { CLASS_ME_MENTION, CLASS_MENTION } from './Constants';
import { isFilePathInIgnoredDirectories } from './IgnoreHelper';
import { getMeMentionOrMentionRegex } from './RegExp';
import { MentionSettings } from './Settings';

export class MentionPostProcessor {
    private subscribers: ((text: string) => void)[] = [];
    private meMentionOrMentionRegex: RegExp = undefined;

    constructor(private element: HTMLElement, private settings: MentionSettings, private ctx: MarkdownPostProcessorContext) {
        // It is OK to set this regular expression here. As for now, the updates of the settings is not supported
        // TODO (IMPROVEMENT): Add a function to update a new RegExp after setting a new TriggerPhrase / new MeMentionName
        this.meMentionOrMentionRegex = getMeMentionOrMentionRegex(this.settings.mentionTriggerPhrase, this.settings.meMentionName);
    }

    public subscribeToMentionClick(fn: (text: string) => void): void {
        this.subscribers.push(fn);
    }

    public addPreviewMentionStyle(): void {
        if (isFilePathInIgnoredDirectories(this.ctx.sourcePath, this.settings)) return;

        if (this.element.firstChild instanceof Node) {
            const nodes = this.getChildNodes(this.element);

            for (let node of nodes) {
                if (node.parentElement.tagName === 'CODE') continue;

                let replacementNodes = this.getReplacementNodesOrNull(node.textContent, this.meMentionOrMentionRegex);
                if (replacementNodes) {
                    node.replaceWith(...replacementNodes);
                }
            }
        }
    }

    private getChildNodes(element: HTMLElement): ChildNode[] {
        const walker = document.createTreeWalker(element.firstChild, NodeFilter.SHOW_TEXT, null);
        const nodes: ChildNode[] = [];
        let node: Node;

        while ((node = walker.nextNode())) {
            nodes.push(node as ChildNode);
        }

        return nodes;
    }

    private getReplacementNodesOrNull(text: string, regExp: RegExp): (string | Node)[] {
        const matches = [...text.matchAll(regExp)];

        if (matches.length > 0) {
            const parts: (string | Node)[] = [];

            // The part before the mention
            const textBeforFirstMention = text.substring(0, matches[0].index);

            parts.push(textBeforFirstMention);

            matches.forEach((m, i) => {
                // The mention it self
                const cls = m[1] != null ? CLASS_ME_MENTION : m[2] != null ? CLASS_MENTION : '';
                const anchorNode = this.surroundWithAnchorTag(m[0], cls);
                parts.push(anchorNode);

                // The part after the mention
                const indexEndTextAfterMention = matches[i + 1] == undefined ? text.length : matches[i + 1].index;
                const indexStartTextAfterMention = m.index + m[0].length;
                const textAfterMention = text.substring(indexStartTextAfterMention, indexEndTextAfterMention);

                parts.push(textAfterMention);
            });

            return parts;
        }

        return null;
    }

    private surroundWithAnchorTag(text: string, className: string): HTMLAnchorElement {
        const anchor = document.createElement('a');

        anchor.addClass(className, 'preview');
        anchor.textContent = text;
        anchor.onClickEvent((_) => {
            this.subscribers.forEach((s) => s(text));
        });

        return anchor;
    }
}
