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
      placeholder="例如：“将主图产品自然融入参考商业展台场景，底部渲染真实接触阴影”、“背景替换为高级极简摄影棚”、“调整整体光影为柔和自然光”..."
      className="w-full p-4 bg-white border-2 border-pink-200 rounded-xl text-sm md:text-base text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition-all duration-200 resize-none flex-1 min-h-[140px]"
    />
  );
};

export default PromptInput;