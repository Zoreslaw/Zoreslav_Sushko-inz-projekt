import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";

/**
 * CancelButtonIcon SVG Component
 *
 * @example
 * // Basic usage
 * <CancelButtonIcon />
 *
 * // Custom size
 * <CancelButtonIcon width={32} height={32} />
 *
 * // Custom fill color
 * <CancelButtonIcon fill="#FF0000" />
 *
 * @param {SvgProps} props - Props for the SVG component
 * @returns {React.ReactElement} The rendered CancelButtonIcon
 */
interface CancelButtonIconProps extends SvgProps {
  fill?: string;
}

const CancelButtonIcon: React.FC<CancelButtonIconProps> = ({
  fill = "#E6E6E6",
  ...props
}) => (
  <Svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    {...props}
  >
    {/* Rounded square-ish shape */}
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.79919 24H17.202C21.2863 24 24 21.0848 24 16.9008V7.0992C24 2.91955 21.2783 0 17.202 0H6.79919C2.71466 0 0 2.9154 0 7.0992V16.9008C0 21.0846 2.71466 24 6.79919 24ZM17.355 1.5H6.64623C3.49562 1.5 1.5 3.64319 1.5 6.95506V17.0449C1.5 20.3568 3.49562 22.5 6.64623 22.5H17.355C20.4976 22.5 22.5 20.3521 22.5 17.0449V6.95506C22.5 3.64284 20.5053 1.5 17.355 1.5Z"
      fill={fill}
    />
    {/* Left half of the X */}
    <Path
      d="M16.7506 7.24544C17.0538 7.54206 17.0804 8.00528 16.8311 8.33114L16.7481 8.42448L13.0626 11.999L16.7481 15.5755C17.0525 15.8709 17.0812 16.334 16.8333 16.6609L16.7506 16.7546C16.4475 17.0512 15.9721 17.0791 15.6366 16.8376L15.5404 16.7571L11.2456 12.5908C10.9402 12.2945 10.9124 11.8297 11.1623 11.5029L11.2456 11.4092L15.5404 7.24293C15.8753 6.91804 16.4171 6.91917 16.7506 7.24544Z"
      fill={fill}
    />
    {/* Right half of the X */}
    <Path
      d="M7.24936 7.24544C6.94619 7.54206 6.91958 8.00528 7.16888 8.33114L7.25194 8.42448L10.9374 11.999L7.25194 15.5755C6.94748 15.8709 6.91884 16.334 7.16671 16.6609L7.24936 16.7546C7.55253 17.0512 8.0279 17.0791 8.36345 16.8376L8.45961 16.7571L12.7544 12.5908C13.0598 12.2945 13.0876 11.8297 12.8377 11.5029L12.7544 11.4092L8.45961 7.24293C8.1247 6.91804 7.58285 6.91917 7.24936 7.24544Z"
      fill={fill}
    />
  </Svg>
);

export default CancelButtonIcon;
