import React from 'react';
import Svg, { G, Rect, Path, Defs, ClipPath } from 'react-native-svg';

interface DefaultAvatarIconProps {
  width?: number | string;
  height?: number | string;
}

const DefaultAvatarIcon: React.FC<DefaultAvatarIconProps> = ({ width = 42, height = 42 }) => {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 42 42"
      fill="none"
    >
      <G clipPath="url(#clip0_494_12798)">
        <Rect
          width={42}
          height={42}
          rx={21}
          fill="#E6E6E6"
        />
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M21 19.8333C23.5773 19.8333 25.6666 17.744 25.6666 15.1667C25.6666 12.5893 23.5773 10.5 21 10.5C18.4227 10.5 16.3333 12.5893 16.3333 15.1667C16.3333 17.744 18.4227 19.8333 21 19.8333ZM21 31.5C25.5103 31.5 29.1666 29.4107 29.1666 26.8333C29.1666 24.256 25.5103 22.1667 21 22.1667C16.4897 22.1667 12.8333 24.256 12.8333 26.8333C12.8333 29.4107 16.4897 31.5 21 31.5Z"
          fill="#494949"
        />
      </G>
      <Defs>
        <ClipPath id="clip0_494_12798">
          <Rect
            width={42}
            height={42}
            rx={21}
            fill="white"
          />
        </ClipPath>
      </Defs>
    </Svg>
  );
};

export default DefaultAvatarIcon;
