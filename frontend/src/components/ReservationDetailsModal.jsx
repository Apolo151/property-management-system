import { useState, useEffect } from 'react';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import { format, parseISO, isValid } from 'date-fns';
import useReservationsStore from '../store/reservationsStore';

const safeFormatDate = (dateString, formatStr = 'MMM dd, yyyy') => {
  if (!dateString) return '-';
  const d = parseISO(dateString);
  return isValid(d) ? format(d, formatStr) : '-';
};

const ReservationDetailsModal = ({ isOpen, onClose, reservationId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reservation, setReservation] = useState(null);
  const fetchReservation = useReservationsStore((state) => state.fetchReservation);

  useEffect(() => {
    if (isOpen && reservationId) {
      const loadReservation = async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetchReservation(reservationId);
          setReservation(res);
        } catch (err) {
          setError(err.message || 'Failed to load reservation details');
        } finally {
          setLoading(false);
        }
      };
      loadReservation();
    } else {
      setReservation(null);
    }
  }, [isOpen, reservationId, fetchReservation]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reservation Details"
      size="md"
    >
      <div className="space-y-4">
        {loading && (
          <div className="flex justify-center p-4">
            <span className="text-gray-500">Loading...</span>
          </div>
        )}
        
        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {!loading && !error && reservation && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-3">
               <div>
                 <span className="text-gray-500 text-sm block">Guest Name</span>
                 <span className="font-medium text-gray-900 dark:text-gray-100">{reservation.guestName}</span>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <span className="text-gray-500 text-sm block">Phone</span>
                   <span className="text-sm text-gray-900 dark:text-gray-100">{reservation.guestPhone || '-'}</span>
                 </div>
                 <div>
                   <span className="text-gray-500 text-sm block">Email</span>
                   <span className="text-sm text-gray-900 dark:text-gray-100">{reservation.guestEmail || '-'}</span>
                 </div>
               </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-3">
               <div className="flex justify-between items-center">
                 <div>
                   <span className="text-gray-500 text-sm block">Room / Type</span>
                   <span className="font-medium text-gray-900 dark:text-gray-100">{reservation.roomNumber}</span>
                 </div>
                 <div>
                   <StatusBadge status={reservation.status} type="reservation" />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <span className="text-gray-500 text-sm block">Check-in</span>
                   <span className="text-sm text-gray-900 dark:text-gray-100">{safeFormatDate(reservation.checkIn)}</span>
                 </div>
                 <div>
                   <span className="text-gray-500 text-sm block">Check-out</span>
                   <span className="text-sm text-gray-900 dark:text-gray-100">{safeFormatDate(reservation.checkOut)}</span>
                 </div>
               </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg flex justify-between items-center">
               <span className="text-gray-500">Total Amount</span>
               <span className="font-bold text-lg text-gray-900 dark:text-gray-100">
                 ${typeof reservation.totalAmount === 'number' ? reservation.totalAmount.toLocaleString() : (Number(reservation.totalAmount) || 0).toLocaleString()}
               </span>
            </div>
            
            <div className="flex justify-end pt-2">
              <button onClick={onClose} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ReservationDetailsModal;
