import { CODEBLOCK_REG_EXP, CODE_INLINE_REG_EXP } from './RegExp';

type CodeblockRange = [from: number, to: number];

export function getCodeblockPositions(text: string, startIndex: number = 0): CodeblockRange[] {
    const codeblocks = [...text.matchAll(CODEBLOCK_REG_EXP), ...text.matchAll(CODE_INLINE_REG_EXP)];
    return codeblocks.map((c) => [startIndex + c.index, startIndex + c.index + c[0].length]);
}

export function isPositionInCodeblock(codeblocks: CodeblockRange[], position: number) {
    return codeblocks.find((c) => c[0] < position && c[1] > position) != null;
}
