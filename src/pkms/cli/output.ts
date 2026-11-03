function strip(s: string): string {
  return s.replace(/\[\/?[a-z][a-z -]*\]/gi, "");
}

export function print(line = ""): void {
  console.log(strip(line));
}

export function esc(s: string): string {
  return s.replace(/\[/g, "");
}
