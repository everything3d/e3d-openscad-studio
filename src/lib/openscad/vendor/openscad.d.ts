// Types for the vendored Emscripten build of OpenSCAD (see openscad.js).
export interface OpenSCADInstance {
  callMain(args: string[]): number
  ENV: Record<string, string>
  FS: {
    mkdir(path: string): void
    writeFile(path: string, data: string | Uint8Array): void
    readFile(path: string): Uint8Array
  }
}

export interface OpenSCADOptions {
  noInitialRun?: boolean
  wasmBinary?: ArrayBuffer | Uint8Array
  print?: (text: string) => void
  printErr?: (text: string) => void
  locateFile?: (path: string, scriptDirectory: string) => string
  /** Callbacks run after FS/ENV exist but before main(). Receives the module. */
  preRun?: Array<(module: OpenSCADInstance) => void>
}

declare function OpenSCAD(options?: OpenSCADOptions): Promise<OpenSCADInstance>
export default OpenSCAD
