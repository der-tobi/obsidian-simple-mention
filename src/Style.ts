import { MentionSettings } from './Settings';

export class Style {
    private style: HTMLStyleElement = document.createElement('style');

    constructor(private readonly settings: MentionSettings) {}

    public appendStyle(): void {
        const css = `
            :root {
                --mention_color: ${this.settings.mentionStyleColor};
                --me_mention_color: ${this.settings.meMentionStyleColor};
            }

            .me_mention {
                color: var(--me_mention_color);
                border: 1px var(--me_mention_color) solid;
                border-radius: 5px;
                padding: 0px .2em 0px 0.05em;
                text-decoration: none;
            }

            .me_mention.preview:hover {
                filter:brightness(130%);
                color: var(--me_mention_color);
                cursor: pointer;
            }

            .mention {
                color: var(--mention_color);
                border: 1px var(--mention_color) solid;
                border-radius: 5px;
                padding: 0px .2em 0px 0.05em;
                text-decoration: none;
            }

            .mention.preview:hover {
                filter:brightness(130%);
                color: var(--mention_color);
                cursor: pointer;
            }

            .mention-view-item {
                cursor: pointer;
                border-radius: 3px;
                position: relative;
                white-space: pre-wrap;
                color: var(--text-normal);
                background: var(--background-search-result);
                padding: 3px 9px;
                margin-bottom: 10px;
            }

            .mention-view-item ul {
                margin-block-start: 0px;
                margin-block-end: 0px;
                line-height: normal;
            }

            .mention-view-item-file {
                font-size: 0.8em;
                border-top: solid 1px;
                filter: brightness(0.5);
            }

            .mention-view-controls-container {
                padding: 0px 0px 20px 0px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .mention-view-select select {
                width: 100%;
            }

            .mention-view-simplefilter input {
                width: 100%;
            }

            .mention-view-includeCompleted {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
        `;

        this.style.appendChild(document.createTextNode(css));
        document.getElementsByTagName('head')[0].appendChild(this.style);
    }

    public removeStyle(): void {
        document.getElementsByTagName('head')[0].removeChild(this.style);
    }

    public updateStyle(): void {
        this.removeStyle();
        this.appendStyle();
    }
}
