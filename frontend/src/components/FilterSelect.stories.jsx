import { useState } from 'react';
import FilterSelect from './FilterSelect';

export default {
  title: 'Components/FilterSelect',
  component: FilterSelect,
};

const options = [
  { value: '', label: 'All' },
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
];

function Stateful(args) {
  const [value, setValue] = useState('');
  return <FilterSelect {...args} value={value} onChange={setValue} options={options} />;
}

export const Default = {
  render: (args) => <Stateful {...args} />,
  args: { label: 'Filter' },
};
