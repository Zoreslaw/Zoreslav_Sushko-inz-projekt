import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

interface CheckIconProps extends SvgProps {
  fill: string;
  fillOpacity?: number;
}

/**
 * A custom CheckIcon SVG component
 * 
 * Usage:
 * <CheckIcon width={15} height={12} fill="#330099" fillOpacity={0.7} />
 */
const CheckIcon: React.FC<CheckIconProps> = ({
  fill,
  ...props
}) => (
  <Svg width={15} height={12} viewBox="0 0 15 12" fill="none" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14.4634 1.64547C14.7857 1.32095 14.7857 0.793391 14.4634 0.468869C14.1418 0.143515 13.6199 0.143515 13.2976 0.468869L4.59613 9.25094L1.86631 6.49666C1.54477 6.17131 1.02206 6.17131 0.700516 6.49666C0.378148 6.82201 0.378148 7.34874 0.700516 7.67326L3.97201 10.9759C3.9852 10.99 3.99756 11.0042 4.01158 11.0175C4.17235 11.1806 4.38342 11.2613 4.59448 11.2613C4.63405 11.2613 4.67363 11.2588 4.7132 11.253C4.88387 11.2289 5.04876 11.1506 5.17985 11.0175C5.19387 11.0042 5.20706 10.99 5.21943 10.9751L14.4634 1.64547Z"
      fill={fill}
    />
  </Svg>
);

export default CheckIcon;
