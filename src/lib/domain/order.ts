/** The order between two neighbours, the way Rust works it out, so a drop shows in place before Rust answers. */
export function between(above: number | undefined, below: number | undefined): number {
  if (above !== undefined && below !== undefined) return (above + below) / 2;
  if (above !== undefined) return above + 1024;
  if (below !== undefined) return below - 1024;
  return 0;
}
