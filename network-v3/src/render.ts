// sigma 3 settings derived from the normalised config.

import type { Settings } from "sigma/settings";
import { EdgeArrowProgram, EdgeRectangleProgram } from "sigma/rendering";
import EdgeCurveProgram, { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
import type { ViewerConfig } from "./config";
import { edgeProgram } from "./edges";

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
    labelRenderedSizeThreshold: config.labels.renderedSizeThreshold,
    minCameraRatio: config.camera.minRatio,
    maxCameraRatio: config.camera.maxRatio,
    edgeReducer: (_edge, attrs) => ({ ...attrs, type: edgeProgram(config.edgeStyle, attrs.directed as boolean | undefined) }),
  };
}
