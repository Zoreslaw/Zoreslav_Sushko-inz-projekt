import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";

/**
 * InfoIconNoBorder SVG Component
 *
 * @example
 * // Basic usage
 * <InfoIconNoBorder />
 *
 * // Custom size
 * <InfoIconNoBorder width={32} height={32} />
 *
 * // Custom fill color
 * <InfoIconNoBorder fill="#000000" />
 *
 * @param {SvgProps} props - Standard react-native-svg props
 * @returns {React.ReactElement} The rendered InfoIconNoBorder component
 */
interface InfoIconNoBorderProps extends SvgProps {
  fill?: string;
}

const InfoIconNoBorder: React.FC<InfoIconNoBorderProps> = ({
  fill = "#000",
  ...props
}) => (
  <Svg
    width={48}
    height={48}
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    {/* Replace these Path data with your own from `info-borderless-svgrepo-com.svg` */}
    <Path
      d="M11.25 6.75C11.25 6.05964 11.8096 5.5 12.5 5.5C13.1904 5.5 13.75 6.05964 13.75 6.75C13.75 7.44036 13.1904 8 12.5 8C11.8096 8 11.25 7.44036 11.25 6.75ZM11.25 10C11.25 9.58579 11.5858 9.25 12 9.25H13C13.4142 9.25 13.75 9.58579 13.75 10V18C13.75 18.4142 13.4142 18.75 13 18.75H12C11.5858 18.75 11.25 18.4142 11.25 18V10Z"
      fill={fill}
    />
  </Svg>
);

export default InfoIconNoBorder;
