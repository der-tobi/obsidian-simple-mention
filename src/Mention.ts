import { Line } from '@codemirror/Text';

export class Occurence {
    constructor(
        public path: string,
        public readonly line: Line,
        public readonly startOccurence: number,
        public readonly endOccurence: number,
        public readonly text: string,
        public readonly isTaskComplete: boolean
    ) {}
}

export class Mention {
    public occurences: Occurence[] = [];

    constructor(public readonly name: string, public readonly isMe: boolean = false) {}

    public addOccurence(o: Occurence): void {
        this.occurences.push(o);
    }

    public removeAllOccurencesOfPath(path: string): void {
        this.occurences.filter((o) => o.path === path).forEach((o) => this.occurences.remove(o));
    }

    public updatePath(oldPath: string, newPath: string): void {
        this.occurences = this.occurences.filter((o) => o.path !== oldPath);
    }

    public hasOccurenceAt(path: string, line: number, index: number): boolean {
        const result = this.occurences
            .filter((o) => o.path === path)
            .find((o) => o.startOccurence <= index && index < o.endOccurence && o.line.number === line);

        return result != null;
    }
    public get isMentioned(): boolean {
        return this.occurences.length > 0;
    }
}
