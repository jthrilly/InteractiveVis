// Which sigma edge program draws each edge. Kept free of sigma imports so it
// can be unit-tested outside a browser.

import type { EdgeStyle } from "./config";

/** sigma program name for each edge style, and its undirected counterpart. */
const PROGRAM_FOR_STYLE: Record<EdgeStyle, { directed: string; undirected: string }> = {
  line: { directed: "line", undirected: "line" },
  arrow: { directed: "arrow", undirected: "line" },
  curve: { directed: "curve", undirected: "curve" },
  curvedArrow: { directed: "curvedArrow", undirected: "curve" },
};

/**
 * Edge program for one edge. Arrow styles draw arrows only on edges the
 * export marks as directed; edges with no `directed` flag (every export
 * before this field existed) follow the configured style as before.
 */
export function edgeProgram(style: EdgeStyle, directed: boolean | undefined): string {
  const programs = PROGRAM_FOR_STYLE[style];
  return directed === false ? programs.undirected : programs.directed;
}
