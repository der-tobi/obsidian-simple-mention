// import { Line } from '@codemirror/Text';

// import { cyrb53Hash } from './cyrb53Hash';

// export class Occurence {
//     constructor(
//         public mention: string,
//         public path: string,
//         public readonly line: Line,
//         public readonly startOccurence: number,
//         public readonly endOccurence: number,
//         public readonly text: string,
//         public readonly isTaskComplete: boolean
//     ) {}
// }

// class OccurencePosition {
//     path: string;
//     linenumber: number;
//     positionFrom: number;
//     positionTo: number;
// }

// export class Mention {
//     public occurences: Occurence[] = [];
//     public occurencesHash: number = undefined;

//     constructor(public readonly name: string, public readonly isMe: boolean = false) {}

// public addOccurence(o: Occurence): void {
//     this.occurences.push(o);
//     this.setOccurenceHash();
// }

// public removeAllOccurencesOfPath(path: string): void {
//     this.occurences.filter((o) => o.path === path).forEach((o) => this.occurences.remove(o));
//     this.setOccurenceHash();
// }

// public updatePath(oldPath: string, newPath: string): void {
//     this.occurences.filter((o) => o.path === oldPath).forEach((o) => (o.path = newPath));
//     this.setOccurenceHash();
// }

// public hasOccurenceAt(path: string, line: number, index: number): boolean {
//     const result = this.occurences
//         .filter((o) => o.path === path)
//         .find((o) => o.startOccurence <= index && index < o.endOccurence && o.line.number === line);

//     return result != null;
// }

// public hasOccurenceAtPath(path: string): boolean {
//     return this.occurences.filter((o) => o.path === path).length > 0 ? true : false;
// }

// public get isMentioned(): boolean {
//     return this.occurences.length > 0;
// }
// private setOccurenceHash() {
//     this.occurencesHash = this.calculateOccurenceHash();
// }

// public calculateOccurenceHash() {
//     return cyrb53Hash(JSON.stringify([...this.occurences].map((o) => o.text).sort()));
// }

// public getOrderedOccurencePositions() {
//     const result = [...this.occurences]
//         .map((o: Occurence) => {
//             return {
//                 path: o.path,
//                 linenumber: o.line.number,
//                 positionFrom: o.startOccurence,
//                 positionTo: o.endOccurence,
//             } as OccurencePosition;
//         })
//         .sort(this.occurencePositionComparer);
//     return result;
// }

// private occurencePositionComparer(a: OccurencePosition, b: OccurencePosition) {
//     return (
//         a.path.localeCompare(b.path) || a.linenumber - b.linenumber || a.positionFrom - b.positionFrom || a.positionTo - b.positionTo
//     );
// }
// }
