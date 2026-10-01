"""List the id of every <path> in an SVG file, one per line.

Usage: python3 svg2js.py INPUT.svg [> ids.txt]

Used to build the list of excluded counties (``dontwant``) in js/process.py:
draw or select the unwanted shapes in an SVG editor, save them as their own
SVG file and run this script on it. Works with Python 2.7 and 3.
"""
from __future__ import print_function

import sys
import xml.dom.minidom


def main(argv):
    if len(argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    doc = xml.dom.minidom.parse(argv[1])
    for node in doc.getElementsByTagName("path"):
        path_id = node.getAttribute("id")
        if path_id:
            print(path_id)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
