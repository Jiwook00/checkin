import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";

interface EmojiPickerPopoverProps {
  onSelect: (emoji: string) => void;
}

// emoji-picker-react 래퍼. ReactionBar에서 lazy import 되어
// 전체 이모지 피커 코드를 초기 번들에서 분리한다.
export default function EmojiPickerPopover({
  onSelect,
}: EmojiPickerPopoverProps) {
  return (
    <EmojiPicker
      onEmojiClick={(data) => onSelect(data.emoji)}
      emojiStyle={EmojiStyle.NATIVE}
      theme={Theme.LIGHT}
      previewConfig={{ showPreview: false }}
      searchPlaceHolder="이모지 검색"
      skinTonesDisabled
      lazyLoadEmojis
      width={300}
      height={360}
    />
  );
}
