// EmojiPicker.jsx
import React from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

const EmojiPicker = ({ onSelect }) => {
  return (
    <div className="emoji-picker-container">
      <Picker data={data} onEmojiSelect={onSelect} />
    </div>
  );
};

export default EmojiPicker;
