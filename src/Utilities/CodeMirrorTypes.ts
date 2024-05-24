export interface CodeMirrorEditor {
    getValue(): string
    setValue(content: string): string
}