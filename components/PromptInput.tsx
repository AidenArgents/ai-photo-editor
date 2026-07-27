import React from 'react';

interface PromptInputProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const PromptInput = ({ value, onChange }: PromptInputProps): React.JSX.Element => {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder="e.g., 'Add a birthday hat to the cat', 'Change the background to a sunny beach', 'Make it look like a vintage photograph'..."
      className="w-full p-3 bg-white border-2 border-pink-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition-all duration-200 resize-none flex-grow"
    />
  );
};

export default PromptInput;