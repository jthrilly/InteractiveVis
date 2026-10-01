// Hover label drawing. sigma 0.1 drew the hovered node's label in a rounded
// box coloured by defaultHoverLabelBGColor with defaultLabelHoverColor text;
// sigma 3's default hover box is white, so this reproduces the old look.
// Ordinary labels are plain text in both versions and use sigma's default.

import type { NodeHoverDrawingFunction } from "sigma/rendering";

const PADDING = 2;

export function makeDrawNodeHover(background: string, color: string): NodeHoverDrawingFunction {
  return (context, data, settings) => {
    const size = settings.labelSize;
    context.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
    context.fillStyle = background;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    context.shadowBlur = 4;
    context.shadowColor = "#000";

    context.beginPath();
    if (typeof data.label === "string" && data.label) {
      const textWidth = context.measureText(data.label).width;
      const boxWidth = Math.round(textWidth + 5);
      const boxHeight = Math.round(size + 2 * PADDING);
      const radius = Math.max(data.size, size / 2) + PADDING;
      const angle = Math.asin(boxHeight / 2 / radius);
      const xDelta = Math.sqrt(Math.abs(radius ** 2 - (boxHeight / 2) ** 2));
      context.moveTo(data.x + xDelta, data.y + boxHeight / 2);
      context.lineTo(data.x + radius + boxWidth, data.y + boxHeight / 2);
      context.lineTo(data.x + radius + boxWidth, data.y - boxHeight / 2);
      context.lineTo(data.x + xDelta, data.y - boxHeight / 2);
      context.arc(data.x, data.y, radius, angle, -angle);
    } else {
      context.arc(data.x, data.y, data.size + PADDING, 0, Math.PI * 2);
    }
    context.closePath();
    context.fill();
    context.shadowBlur = 0;

    if (typeof data.label === "string" && data.label) {
      context.fillStyle = color;
      context.fillText(data.label, data.x + data.size + 3, data.y + size / 3);
    }
  };
}
