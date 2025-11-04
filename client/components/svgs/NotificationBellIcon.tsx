import * as React from "react";
import Svg, { Path, SvgProps, Circle, Text } from "react-native-svg";

/**
 * NotificationBellIcon
 *
 * @example
 * // Basic usage
 * <NotificationBellIcon />
 *
 * // Custom size
 * <NotificationBellIcon width={20} height={25} />
 *
 * // Passing notification count
 * <NotificationBellIcon notificationCount={3} />
 *
 * @param {notificationCount} number - The number of notifications to display
 * @param {SvgProps} props         - Any other SVG props (e.g., style, color overrides)
 */
interface NotificationBellIconProps extends SvgProps {
  /**
   * Number of notifications.
   */
  notificationCount?: number;
}

const NotificationBellIcon: React.FC<NotificationBellIconProps> = ({
  notificationCount = 0,
  ...props
}) => {
  // If > 9, display "9+"; else display the actual number
  const displayCount = notificationCount > 9 ? "9+" : String(notificationCount);

  return (
    <Svg
      width={14}
      height={18}
      viewBox="0 0 14 18"
      fill="none"
      {...props}
    >
      {/* The filled circle at the top of the bell (white by default) */}
      <Path
        d="M13 3.4C13 4.72548 11.9926 5.8 10.75 5.8C9.50736 5.8 8.5 4.72548 8.5 3.4C8.5 2.07452 9.50736 1 10.75 1C11.9926 1 13 2.07452 13 3.4Z"
        fill="white"
      />
      {/* The main bell shape (outlined in white) */}
      <Path
        d="M6.30379 2.65559C4.1975 2.99478 2.513 4.85035 2.25973 7.23522L2.00107 9.67079C1.9368 10.276 1.70685 10.8455 1.34162 11.304C0.566565 12.2771 1.19561 13.8 2.3726 13.8H11.6274C12.8044 13.8 13.4334 12.2771 12.6584 11.304C12.2932 10.8455 12.0632 10.276 11.9989 9.6708L11.828 8.06139M9.25 15.4C8.92249 16.3322 8.03877 17 7 17C5.96123 17 5.07751 16.3322 4.75 15.4M13 3.4C13 4.72548 11.9926 5.8 10.75 5.8C9.50736 5.8 8.5 4.72548 8.5 3.4C8.5 2.07452 9.50736 1 10.75 1C11.9926 1 13 2.07452 13 3.4Z"
        stroke="white"
        strokeLinecap="round"
      />

      {/* Notification badge if there's any notifications */}
      {notificationCount > 0 && (
        <>
          {/* Badge circle (red) */}
          <Circle
            cx={11}   // Adjust these to position the badge
            cy={3}    // near the top-right of the bell
            r={3}     // Adjust the radius to size the badge
            fill="red"
          />
          {/* Badge text */}
          <Text
            x={11}    // same center x as the circle
            y={3}     // same center y as the circle
            fill="white"
            fontSize={notificationCount > 9 ? 5 : 6} // smaller if '9+'
            fontWeight="bold"
            textAnchor="middle"       // center horizontally
            alignmentBaseline="middle" // center vertically
          >
            {displayCount}
          </Text>
        </>
      )}
    </Svg>
  );
};

export default NotificationBellIcon;
