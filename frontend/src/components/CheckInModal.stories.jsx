import CheckInModal from './CheckInModal';

const mockReservation = {
  id: 'res-1',
  guestName: 'Ada Lovelace',
  roomNumber: '101',
  roomId: 'room-1',
  checkIn: '2026-04-16',
  checkOut: '2026-04-18',
  status: 'Confirmed',
};

export default {
  title: 'Components/CheckInModal',
  component: CheckInModal,
};

export const Open = {
  args: {
    isOpen: true,
    onClose: () => {},
    reservation: mockReservation,
  },
};
