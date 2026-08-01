export function sourceLine(source: string, offset: number) {
  return source.slice(0, offset).split("\n").length;
}

export function editableSnippetSelection(snippet: string) {
  const field = /:\s*("([^"]*)"|([^\n]*))/.exec(snippet);
  if (!field || field.index === undefined)
    return { from: snippet.length, to: snippet.length };
  const rawValue = field[1];
  const valueFrom = field.index + field[0].indexOf(rawValue);
  return rawValue.startsWith('"')
    ? { from: valueFrom + 1, to: valueFrom + rawValue.length - 1 }
    : { from: valueFrom, to: valueFrom + rawValue.length };
}
