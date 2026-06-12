declare module 'nspell' {
  export interface Nspell {
    correct(word: string): boolean
    suggest(word: string): string[]
    add(word: string, model?: string): Nspell
    remove(word: string): Nspell
    wordCharacters(): string[] | undefined
    dictionary(dic: string | Buffer): Nspell
    personal(dic: string | Buffer): Nspell
  }
  export default function nspell(
    aff: string | Buffer | { aff: string | Buffer; dic: string | Buffer },
    dic?: string | Buffer,
  ): Nspell
}
