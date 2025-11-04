import * as React from "react";
import Svg, { SvgProps, Circle, Path } from "react-native-svg";

/**
 * LikeButtonIcon SVG Component
 *
 * @example
 * // Basic usage
 * <LikeButtonIcon />
 *
 * // Custom size
 * <LikeButtonIcon width={80} height={80} />
 *
 * // Custom colors
 * <LikeButtonIcon circleStroke="#000" heartFill="#FF0000" />
 *
 * @param {SvgProps} props - The props for the SVG component
 * @returns {React.ReactElement} The rendered LikeButtonIcon component
 */
interface LikeButtonIconProps extends SvgProps {
  /**
   * Circle stroke color
   */
  circleStroke?: string;
  /**
   * Circle stroke width
   */
  circleStrokeWidth?: number;
  /**
   * Heart fill color
   */
  heartFill?: string;
}

const LikeButtonIcon: React.FC<LikeButtonIconProps> = ({
  circleStroke = "#00D387",
  circleStrokeWidth = 2,
  heartFill = "#00D387",
  ...props
}) => (
  <Svg
    width={62}
    height={62}
    viewBox="0 0 62 62"
    fill="none"
    {...props}
  >
    <Circle
      cx={31}
      cy={31}
      r={30}
      stroke={circleStroke}
      strokeWidth={circleStrokeWidth}
    />
    <Path
      d="M37.9893 19.0142C33.2178 19.0142 31.2012 22.3799 31.2012 22.3799C31.2012 22.3799 29.1846 19 24.413 19C20.3799 19.0142 17 22.3799 17 26.3988C17 35.6154 31.2012 43 31.2012 43C31.2012 43 45.4024 35.6154 45.4024 26.3988C45.4024 22.3799 42.0225 19.0142 37.9893 19.0142Z"
      fill={heartFill}
    />
  </Svg>
);

export default LikeButtonIcon;
