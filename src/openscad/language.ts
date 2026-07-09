import { StreamLanguage, type StringStream } from '@codemirror/language'

// A lightweight OpenSCAD highlighting mode. Not a full parser — just enough
// to make the editor pleasant to read.
const KEYWORDS = new Set([
  'module',
  'function',
  'if',
  'else',
  'for',
  'intersection_for',
  'let',
  'each',
  'use',
  'include',
  'true',
  'false',
  'undef',
])

const BUILTINS = new Set([
  // transforms & booleans
  'union',
  'difference',
  'intersection',
  'translate',
  'rotate',
  'scale',
  'resize',
  'mirror',
  'multmatrix',
  'color',
  'offset',
  'hull',
  'minkowski',
  'render',
  'children',
  'projection',
  'linear_extrude',
  'rotate_extrude',
  'surface',
  // primitives
  'cube',
  'sphere',
  'cylinder',
  'polyhedron',
  'square',
  'circle',
  'polygon',
  'text',
  'import',
  // math / util
  'abs',
  'sign',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'floor',
  'ceil',
  'round',
  'ln',
  'log',
  'pow',
  'sqrt',
  'exp',
  'min',
  'max',
  'norm',
  'cross',
  'concat',
  'lookup',
  'str',
  'chr',
  'ord',
  'len',
  'search',
  'echo',
  'assert',
  'rands',
])

interface State {
  inComment: boolean
}

export const openscad = StreamLanguage.define<State>({
  name: 'openscad',
  startState: () => ({ inComment: false }),
  token(stream: StringStream, state: State): string | null {
    if (state.inComment) {
      if (stream.match(/.*?\*\//)) state.inComment = false
      else stream.skipToEnd()
      return 'comment'
    }
    if (stream.match('/*')) {
      state.inComment = true
      return 'comment'
    }
    if (stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match(/"(?:[^"\\]|\\.)*"?/)) return 'string'
    if (stream.match(/-?\d+\.?\d*(?:e[+-]?\d+)?/i)) return 'number'
    if (stream.match(/\$[a-zA-Z_]\w*/)) return 'variableName.special'

    const word = stream.match(/[a-zA-Z_]\w*/)
    if (word) {
      const w = (word as RegExpMatchArray)[0]
      if (KEYWORDS.has(w)) return 'keyword'
      if (BUILTINS.has(w)) return 'builtin'
      return 'variableName'
    }

    if (stream.match(/[{}()\[\];,]/)) return 'punctuation'
    if (stream.match(/[-+*/%!<>=&|?:.#]/)) return 'operator'

    stream.next()
    return null
  },
  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
  },
})
