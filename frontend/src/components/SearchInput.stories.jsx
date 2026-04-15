import { useState } from 'react';
import SearchInput from './SearchInput';

export default {
  title: 'Components/SearchInput',
  component: SearchInput,
};

function Stateful(args) {
  const [value, setValue] = useState('');
  return <SearchInput {...args} value={value} onChange={setValue} />;
}

export const Default = {
  render: (args) => <Stateful {...args} />,
  args: { placeholder: 'Search…' },
};
