import { useState } from 'react';
import GuestSelect from './GuestSelect';

const mockGuests = [
  { id: '1', name: 'Ada Lovelace', email: 'ada@example.com', phone: '+1 555-0100' },
  { id: '2', name: 'Alan Turing', email: 'alan@example.com', phone: '+1 555-0101' },
];

export default {
  title: 'Components/GuestSelect',
  component: GuestSelect,
};

function Stateful() {
  const [value, setValue] = useState('');
  return (
    <div className="w-80">
      <GuestSelect
        value={value}
        onChange={setValue}
        guests={mockGuests}
        onCreateGuest={async () => ({ id: 'new', name: 'New Guest' })}
      />
    </div>
  );
}

export const Default = {
  render: () => <Stateful />,
};
