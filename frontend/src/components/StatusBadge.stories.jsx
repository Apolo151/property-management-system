import StatusBadge from './StatusBadge';

export default {
  title: 'Components/StatusBadge',
  component: StatusBadge,
};

export const ReservationConfirmed = {
  args: { status: 'Confirmed', type: 'reservation' },
};

export const InvoicePaid = {
  args: { status: 'Paid', type: 'invoice' },
};
