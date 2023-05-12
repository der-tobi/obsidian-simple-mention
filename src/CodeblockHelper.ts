import { CODEBLOCK_REG_EXP } from './RegExp';

export function getCodeblockPositions(text: string, startIndex: number = 0): [from: number, to: number][] {
    const codeblocks = [...text.matchAll(CODEBLOCK_REG_EXP)];
    let codeblockPositions: [from: number, to: number][] = [];
    return codeblocks.map((c) => [startIndex + c.index, startIndex + c.index + c[0].length]);
}

export function isPositionInCodeblock(codeblocks: [from: number, to: number][], position: number) {
    return codeblocks.find((c) => c[0] < position && c[1] > position) != null;
}
