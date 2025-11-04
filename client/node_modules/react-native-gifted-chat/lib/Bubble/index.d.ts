import React from 'react';
import { IMessage } from '../types';
import { BubbleProps } from './types';
export * from './types';
export default class Bubble<TMessage extends IMessage = IMessage> extends React.Component<BubbleProps<TMessage>> {
    static contextType: React.Context<import("..").IGiftedChatContext>;
    onPress: () => void;
    onLongPress: () => void;
    styledBubbleToNext(): (import("react-native").StyleProp<import("react-native").ViewStyle> | {
        borderBottomLeftRadius: number;
    } | {
        borderBottomRightRadius: number;
    })[] | null;
    styledBubbleToPrevious(): (import("react-native").StyleProp<import("react-native").ViewStyle> | {
        borderTopLeftRadius: number;
    } | {
        borderTopRightRadius: number;
    })[] | null;
    renderQuickReplies(): string | number | bigint | boolean | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | React.JSX.Element | null | undefined;
    renderMessageText(): string | number | bigint | boolean | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | React.JSX.Element | null | undefined;
    renderMessageImage(): string | number | bigint | boolean | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | React.JSX.Element | null | undefined;
    renderMessageVideo(): string | number | bigint | boolean | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | React.JSX.Element | null | undefined;
    renderMessageAudio(): string | number | bigint | boolean | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | React.JSX.Element | null | undefined;
    renderTicks(): string | number | bigint | boolean | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | React.JSX.Element | null | undefined;
    renderTime(): string | number | bigint | boolean | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | React.JSX.Element | null | undefined;
    renderUsername(): string | number | bigint | boolean | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | React.JSX.Element | null | undefined;
    renderCustomView(): React.ReactNode;
    renderBubbleContent(): React.JSX.Element;
    render(): React.JSX.Element;
}
