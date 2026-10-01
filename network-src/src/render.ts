// sigma 3 settings derived from the normalised config.

import type { Settings } from "sigma/settings";
import { EdgeArrowProgram, EdgeRectangleProgram } from "sigma/rendering";
import EdgeCurveProgram, { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
import type { ViewerConfig } from "./config";
import { edgeProgram } from "./edges";
import { makeDrawNodeHover } from "./labels";

export const LABEL_FONT = "Arial, Helvetica, sans-serif";

export function sigmaSettings(config: ViewerConfig): Partial<Settings> {
  return {
    defaultEdgeType: edgeProgram(config.edgeStyle, undefined),
    edgeProgramClasses: {
      line: EdgeRectangleProgram,
      arrow: EdgeArrowProgram,
      curve: EdgeCurveProgram,
      curvedArrow: EdgeCurvedArrowProgram,
    },
    labelColor: { color: config.labels.color },
    labelSize: config.labels.size,
    labelWeight: config.labels.weight,
    labelFont: LABEL_FONT,
    // sigma 0.1 compared labelThreshold with the node's on-screen radius,
    // which grew with the square root of the zoom, exactly like sigma 3's
    // rendered size, so the configured number carries over unchanged.
    labelRenderedSizeThreshold: config.labels.renderedSizeThreshold,
    defaultDrawNodeHover: makeDrawNodeHover(config.labels.hoverBackground, config.labels.hoverColor),
    // sigma 3's default minimum of 1.7px buries dense networks under their edges.
    minEdgeThickness: 0.5,
    zIndex: true,
    minCameraRatio: config.camera.minRatio,
    maxCameraRatio: config.camera.maxRatio,
  };
}
