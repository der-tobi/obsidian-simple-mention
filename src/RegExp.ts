// \\p{L} + u Flag to match all unicode letters: https://stackoverflow.com/questions/3617797/regex-to-match-only-letters
export const MENTION_SUGGEST_REG_EXP = new RegExp('(^"[\\p{L}0-9-_, ]*$)|(^[\\p{L}0-9-_,]*$)', 'u');
export const TASK_REG_EXP = new RegExp(/\[[ x]{1}\]/);
export const TASK_COMPLETE_REG_EXP = new RegExp(/^\- \[x{1}\]/);
export const CODEBLOCK_REG_EXP = new RegExp('```[a-zA-Z0-9\\w\\d\\s!@#$%^&*()_+-=\\[\\]{};\':"\\|,.<>/?]*```', 'gm');

export function getMeMentionOrMentionRegex(trigger: string, meMentionName: string): RegExp {
    return new RegExp(getMeMentionRegExp(trigger, meMentionName).source + '|' + getMentionRegExp(trigger).source, 'gmu');
}

export function getMentionRegExp(trigger: string): RegExp {
    return new RegExp(`(\\B${trigger}[\\p{L}0-9-_,]+|\\B${trigger}"[\\p{L}0-9-_, ]+")`, 'gmu');
}

export function getMeMentionRegExp(trigger: string, meMentionName: string): RegExp {
    return new RegExp(`(\\B${trigger}${meMentionName})`, 'gmu');
}
