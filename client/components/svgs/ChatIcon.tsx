import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";

/**
 * ChatIcon SVG Component
 *
 * @example
 * // Basic usage
 * <ChatIcon />
 *
 * // Custom size
 * <ChatIcon width={40} height={40} />
 *
 * // Custom stroke color
 * <ChatIcon stroke="#000000" />
 *
 * @param {SvgProps} props - The props for the SVG component
 * @returns {React.ReactElement} The rendered ChatIcon SVG component
 */
interface ChatIconProps extends SvgProps {
  /**
   * Stroke color for the icon.
   */
  stroke?: string;
}

const ChatIcon: React.FC<ChatIconProps> = ({
  stroke = "white",
  ...props
}) => (
  <Svg
    width={27}
    height={26}
    viewBox="0 0 27 26"
    fill="none"
    {...props}
  >
    <Path
      d="M8.7 10.3333H18.3M8.7 15.6667H13.5M12.3 1H14.7C20.6647 1 25.5 6.37258 25.5 13C25.5 19.6274 20.6647 25 14.7 25H6.3C3.64903 25 1.5 22.6122 1.5 19.6667V13C1.5 6.37258 6.33532 1 12.3 1Z"
      stroke={stroke}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

export default ChatIcon;
