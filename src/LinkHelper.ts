import { LINK_REG_EXP } from './RegExp';

type LinkRange = [from: number, to: number];

export function getLinkPositions(text: string, startIndex: number = 0): LinkRange[] {
    const codeblocks = [...text.matchAll(LINK_REG_EXP)];
    return codeblocks.map((c) => [startIndex + c.index, startIndex + c.index + c[0].length]);
}

export function isPositionInLink(links: LinkRange[], position: number) {
    return links.find((c) => c[0] < position && c[1] > position) != null;
}

