import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";
import { StyleProp, ViewStyle } from "react-native";
/**
 * ProfileIcon SVG Component
 *
 * @example
 * // Basic usage
 * <ProfileIcon />
 *
 * // Custom size
 * <ProfileIcon width={30} height={28} />
 *
 * // Custom stroke color
 * <ProfileIcon stroke="#000000" />
 *
 * @param {SvgProps} props - The props for the SVG component
 * @returns {React.ReactElement} The rendered ProfileIcon SVG component
 */
interface ProfileIconProps extends SvgProps {
  /**
   * The stroke color of the icon
   */
  stroke?: string;
  style?: StyleProp<ViewStyle>;
}

const ProfileIcon: React.FC<ProfileIconProps> = ({
  stroke = "white",
  ...props
}) => (
  <Svg
    width={25}
    height={24}
    viewBox="0 0 25 24"
    fill="none"
    {...props}
  >
    <Path
      d="M12.5 12C15.2614 12 17.5 9.76142 17.5 7C17.5 4.23858 15.2614 2 12.5 2C9.73858 2 7.5 4.23858 7.5 7C7.5 9.76142 9.73858 12 12.5 12Z"
      stroke={stroke}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M21.09 22C21.09 18.13 17.24 15 12.5 15C7.76003 15 3.91003 18.13 3.91003 22"
      stroke={stroke}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default ProfileIcon;
